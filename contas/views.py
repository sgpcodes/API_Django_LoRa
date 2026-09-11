import logging
import os
import sys

import django
import requests
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Prefetch
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from api_rest.models import Estacao, Leitura, SolicitacaoRssi
from api_rest.permissions import EhGestor

from .emails import enviar_email_confirmacao
from .manutencao import executar_limpeza_operacional, resumir_limpeza_operacional
from .models import Assinatura, Funcionalidade, LogAuditoria, Plano, Usuario
from .serializers import (
    AssinaturaSerializer,
    CadastroSerializer,
    ConfirmarEmailSerializer,
    FuncionalidadeSerializer,
    LogAuditoriaSerializer,
    PlanoSerializer,
    RecredenciarSerializer,
    ReenviarConfirmacaoPublicoSerializer,
    TokenObtainPairComRoleSerializer,
    UsuarioSerializer,
)

logger = logging.getLogger(__name__)


def _identificar_usuario(usuario):
    """{'username', 'nome'} pra guardar no `detalhes` do LogAuditoria — na
    hora de escrever, não na hora de ler: depois de excluída, a conta não
    existe mais pro `alvo` (GenericForeignKey) resolver, e mesmo pra
    contas vivas, o nome/plano no momento do evento pode não ser mais o
    nome/plano atual. Guardar aqui garante que "Atividade recente" mostra
    o que era verdade quando o evento aconteceu."""
    nome = f'{usuario.first_name} {usuario.last_name}'.strip()
    return {'username': usuario.username, 'nome': nome or usuario.username}


def _tokens_para(usuario):
    """Monta {access, refresh} pro `usuario` do mesmo jeito que o login
    (mesmas claims — role, precisa_recredenciar) — usado tanto pelo login
    de verdade quanto pelo cadastro (auto-login) e pelo recredenciamento
    (tokens atualizados refletindo o novo estado, sem precisar logar de novo)."""
    token = TokenObtainPairComRoleSerializer.get_token(usuario)
    return {'access': str(token.access_token), 'refresh': str(token)}


class TokenObtainPairComRoleView(TokenObtainPairView):
    """POST /api/auth/token/ — login (RN20): troca usuário+senha por um
    par de tokens JWT (access + refresh), com `role` embutido no token."""

    serializer_class = TokenObtainPairComRoleSerializer


class CadastroView(APIView):
    """POST /api/auth/cadastro/ — cadastro público (tela "Criar conta").
    Sem login: qualquer um pode chamar.

    RN: o cadastro só se completa de verdade com o e-mail confirmado —
    a conta já é criada aqui (existe no banco, o link de confirmação já
    funciona), mas esta resposta NÃO devolve tokens de acesso. A pessoa
    só consegue entrar (POST /api/auth/token/) depois de clicar no link.
    Se o envio do e-mail falhar (provedor fora do ar etc.), a conta
    continua existindo do mesmo jeito — dá pra pedir reenvio depois em
    /api/auth/reenviar-confirmacao-publico/.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        # ator=None: cadastro público, nenhum Gestor envolvido — LogAuditoria
        # aceita isso (SET_NULL), diferente de quando é o Gestor quem cria a
        # conta pela tela de Contas (ver UsuarioViewSet.perform_create).
        LogAuditoria.objects.create(ator=None, acao='usuario.criado', alvo=usuario, detalhes=_identificar_usuario(usuario))

        try:
            enviar_email_confirmacao(usuario)
        except Exception:
            logger.exception('Falha ao enviar e-mail de confirmação para %s', usuario.email)

        return Response(
            {
                'status': 'pending_email_confirmation',
                'message': 'Cadastro quase completo! Enviamos um link de confirmação para o seu e-mail.',
                'email': usuario.email,
            },
            status=status.HTTP_201_CREATED,
        )


class ConfirmarEmailView(APIView):
    """POST /api/auth/confirmar-email/ — chamado pela página que o link do
    e-mail abre (frontend lê uidb64/token da URL e manda pra cá). Sem
    login: é o próprio link que autentica a ação."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ConfirmarEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'status': 'success', 'message': 'E-mail confirmado com sucesso.'})


class ReenviarConfirmacaoView(APIView):
    """POST /api/auth/reenviar-confirmacao/ — a própria conta logada pede
    pra receber o e-mail de confirmação de novo (link antigo perdido,
    caiu no spam etc.)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.email_verificado:
            return Response({'status': 'error', 'message': 'Este e-mail já está confirmado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            enviar_email_confirmacao(request.user)
        except Exception:
            logger.exception('Falha ao reenviar e-mail de confirmação para %s', request.user.email)
            return Response(
                {'status': 'error', 'message': 'Não foi possível enviar o e-mail agora. Tente de novo em instantes.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({'status': 'success', 'message': 'E-mail de confirmação reenviado.'})


class ReenviarConfirmacaoPublicoView(APIView):
    """POST /api/auth/reenviar-confirmacao-publico/ — pra quem NÃO
    consegue logar ainda (login trava sem e-mail confirmado, ver
    TokenObtainPairComRoleSerializer) pedir o link de novo sem estar
    autenticado. Responde sempre a mesma mensagem genérica, exista ou não
    aquele e-mail cadastrado — não é da conta de ninguém de fora saber
    se um e-mail tem conta aqui ou não."""

    permission_classes = [AllowAny]

    mensagem_generica = {
        'status': 'success',
        'message': 'Se existir uma conta com esse e-mail, reenviamos o link de confirmação.',
    }

    def post(self, request):
        serializer = ReenviarConfirmacaoPublicoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        usuario = Usuario.objects.filter(
            username__iexact=serializer.validated_data['email'],
        ).first()

        if usuario is not None and not usuario.email_verificado:
            try:
                enviar_email_confirmacao(usuario)
            except Exception:
                logger.exception('Falha ao reenviar e-mail de confirmação (público) para %s', usuario.email)

        return Response(self.mensagem_generica)


class RecredenciarView(APIView):
    """POST /api/auth/recredenciar/ — quem já está logado digita o token
    de credenciamento (novo, se o antigo rotacionou; ou pela primeira vez,
    se quiser virar Gestor a partir de uma conta comum) e recebe tokens
    novos já refletindo o `role`/`precisa_recredenciar` atualizados."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RecredenciarSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return Response(_tokens_para(usuario), status=status.HTTP_200_OK)


class LimparDadosOperacionaisView(APIView):
    """Zona de risco do painel admin: apaga contas (exceto superusuário)
    e dados de clima já recebidos, sem tocar em Planos/Funcionalidades/
    TokenCredenciamento. Mesma lógica do comando de terminal
    `limpar_dados_operacionais` (ver contas/manutencao.py) — esta é a
    via pra quem não tem acesso ao Shell do servidor.

    GET: só a prévia (dry-run), nunca apaga nada — é o que a tela mostra
    antes da pessoa confirmar.
    POST: apaga de verdade, mas só se o corpo vier com
    `{"confirmar": true}` — sem isso, nem que seja um POST vazio por
    engano, não faz nada."""

    permission_classes = [IsAuthenticated, EhGestor]

    def get(self, request):
        return Response(resumir_limpeza_operacional())

    def post(self, request):
        if request.data.get('confirmar') is not True:
            return Response(
                {'status': 'error', 'message': 'Envie {"confirmar": true} no corpo pra executar de verdade.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resumo = executar_limpeza_operacional()
        LogAuditoria.objects.create(
            ator=request.user, acao='manutencao.limpeza_operacional', detalhes=resumo,
        )
        return Response({'status': 'success', **resumo})


# Ações de LogAuditoria que viram notificação real na tela do Gestor
# (RN05) — cadastro/exclusão de conta e mudança nos usuários vinculados a
# uma estação. Deixado como lista explícita (em vez de "tudo") pra não
# virar um feed de ruído com toda ação administrativa (ex.: limpeza
# operacional não é uma "notificação").
ACOES_NOTIFICAVEIS = ['estacao.criada', 'estacao.usuarios_alterados']


class AuditoriaRecenteView(APIView):
    """GET /api/auditoria/recentes/ — últimos eventos relevantes pra
    notificação do Gestor (estações cadastradas/reatribuídas). Só leitura,
    Gestor-only (RN01) — o log em si guarda tudo, mas essa tela só
    precisa do que é "notificação", não de auditoria completa."""

    permission_classes = [IsAuthenticated, EhGestor]

    def get(self, request):
        eventos = LogAuditoria.objects.filter(acao__in=ACOES_NOTIFICAVEIS).select_related('ator')[:100]
        return Response(LogAuditoriaSerializer(eventos, many=True).data)


def _tamanho_legivel(num_bytes):
    if num_bytes is None:
        return None
    valor = float(num_bytes)
    for unidade in ('B', 'KB', 'MB', 'GB', 'TB'):
        if valor < 1024:
            return f'{valor:.1f} {unidade}'
        valor /= 1024
    return f'{valor:.1f} PB'


def _tamanho_do_banco():
    """Tamanho de verdade do banco — consulta nativa do Postgres em
    produção; em dev (sqlite local) usa o tamanho do arquivo. Sem
    fallback inventado: se não der pra descobrir, devolve None e o
    front mostra "—", em vez de estimar um número que não existe."""
    try:
        if connection.vendor == 'postgresql':
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_database_size(current_database())')
                return cursor.fetchone()[0]
        if connection.vendor == 'sqlite':
            caminho = connection.settings_dict.get('NAME')
            return os.path.getsize(caminho) if caminho and os.path.exists(caminho) else None
    except Exception:
        logger.warning('Não foi possível determinar o tamanho do banco.', exc_info=True)
        return None
    return None


def _tamanho_tabela(model):
    """Tamanho real de UMA tabela (índices incluídos) — só Postgres tem
    esse catálogo; devolve None fora dele em vez de estimar."""
    if connection.vendor != 'postgresql':
        return None
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_total_relation_size(%s)', [model._meta.db_table])
            linha = cursor.fetchone()
            return linha[0] if linha and linha[0] is not None else 0
    except Exception:
        logger.warning('Não foi possível determinar o tamanho da tabela %s.', model._meta.db_table, exc_info=True)
        return None


def _tamanho_por_categoria(tamanho_total_bytes):
    """Quebra o tamanho do banco em 4 categorias reais, consultando o
    tamanho de cada tabela (Postgres). "Outros" é o resto (tabelas
    internas do Django — sessão, admin, content types etc.) — não uma
    estimativa, é tamanho_total menos o que já contamos nas outras 3.
    Só Postgres: em dev (sqlite) devolve None, front mostra estado vazio
    em vez de inventar uma proporção."""
    if connection.vendor != 'postgresql' or tamanho_total_bytes is None:
        return None

    tamanho_meteorologicos = _tamanho_tabela(Leitura)
    tamanho_contas_estacoes = sum(
        filter(None, [_tamanho_tabela(Usuario), _tamanho_tabela(Estacao), _tamanho_tabela(Assinatura)])
    )
    tamanho_logs = _tamanho_tabela(LogAuditoria)
    if tamanho_meteorologicos is None or tamanho_logs is None:
        return None

    conhecidos = tamanho_meteorologicos + tamanho_contas_estacoes + tamanho_logs
    tamanho_outros = max(tamanho_total_bytes - conhecidos, 0)

    categorias = {
        'dados_meteorologicos': tamanho_meteorologicos,
        'contas_e_estacoes': tamanho_contas_estacoes,
        'logs_e_auditoria': tamanho_logs,
        'outros': tamanho_outros,
    }
    return {
        chave: {
            'tamanho_bytes': valor,
            'tamanho_legivel': _tamanho_legivel(valor),
            'percentual': round((valor / tamanho_total_bytes) * 100) if tamanho_total_bytes > 0 else 0,
        }
        for chave, valor in categorias.items()
    }


def _leituras_por_mes(meses=6):
    """Total de leituras recebidas por mês, últimos `meses` meses
    (incluindo o atual) — agregação real no banco (GROUP BY mês), não uma
    amostra: o "Crescimento da plataforma" soma isso com contas/estações
    novas por mês, que o front já calcula a partir das listas que ele
    mesmo busca (evita duplicar essa lógica aqui)."""
    agora = timezone.now()
    # Meses corridos de verdade (não "30 dias vezes N", que desvia do
    # calendário) — mesmo critério usado no cálculo de contas/estações
    # novas por mês, feito no front a partir das listas que ele já busca.
    ano_inicio, mes_inicio = agora.year, agora.month - (meses - 1)
    while mes_inicio <= 0:
        mes_inicio += 12
        ano_inicio -= 1
    primeiro_mes = agora.replace(
        year=ano_inicio, month=mes_inicio, day=1, hour=0, minute=0, second=0, microsecond=0,
    )
    linhas = (
        Leitura.objects.filter(data_hora__gte=primeiro_mes)
        .annotate(mes=TruncMonth('data_hora'))
        .values('mes')
        .annotate(total=Count('id'))
    )
    return [{'ano': linha['mes'].year, 'mes': linha['mes'].month, 'total': linha['total']} for linha in linhas]


def _checar_integracao(chave, url, **kwargs):
    """Ping curto (GET com timeout baixo) numa API externa — resultado
    fica em cache por alguns minutos pra não bater na API de novo a
    cada carregamento da tela de Manutenção."""
    cache_key = f'manutencao:integracao:{chave}'
    resultado = cache.get(cache_key)
    if resultado is None:
        try:
            resposta = requests.get(url, timeout=4, **kwargs)
            online = resposta.status_code < 500
        except requests.RequestException:
            online = False
        resultado = {'online': online, 'verificado_em': timezone.now().isoformat()}
        cache.set(cache_key, resultado, 60 * 5)
    return resultado


class InfoSistemaView(APIView):
    """GET /api/manutencao/info-sistema/ — painel de "entranhas do
    sistema" na tela de Manutenção: tamanho real do banco, contagem por
    tabela, atividade recente (mesmo LogAuditoria da tela de
    Notificações), status das integrações externas (INMET/IBGE/Open-Meteo/Resend) e
    versão do ambiente. Só leitura, Gestor-only — nada aqui é inventado,
    só reúne números que já existem em outros lugares do sistema."""

    permission_classes = [IsAuthenticated, EhGestor]

    def get(self, request):
        tamanho_bytes = _tamanho_do_banco()
        quota_gb = settings.DATABASE_QUOTA_GB
        quota_bytes = quota_gb * (1024 ** 3) if quota_gb else None

        try:
            dias = int(request.query_params.get('dias', 30))
        except ValueError:
            dias = 30
        agora = timezone.now()
        limite = agora - timezone.timedelta(days=dias)
        limite_anterior = agora - timezone.timedelta(days=dias * 2)
        leituras_periodo = Leitura.objects.filter(data_hora__gte=limite).count()
        leituras_periodo_anterior = Leitura.objects.filter(
            data_hora__gte=limite_anterior, data_hora__lt=limite,
        ).count()
        tendencia_leituras = (
            round((leituras_periodo - leituras_periodo_anterior) / leituras_periodo_anterior * 100)
            if leituras_periodo_anterior > 0 else None
        )

        return Response({
            'banco': {
                'motor': connection.vendor,
                'tamanho_bytes': tamanho_bytes,
                'tamanho_legivel': _tamanho_legivel(tamanho_bytes),
                'quota_gb': quota_gb,
                'percentual_uso': (
                    round((tamanho_bytes / quota_bytes) * 100, 1)
                    if tamanho_bytes is not None and quota_bytes else None
                ),
            },
            'banco_por_categoria': _tamanho_por_categoria(tamanho_bytes),
            'contagens': {
                'contas': Usuario.objects.count(),
                'estacoes': Estacao.objects.count(),
                'leituras': Leitura.objects.count(),
                'solicitacoes_rssi': SolicitacaoRssi.objects.count(),
                'log_auditoria': LogAuditoria.objects.count(),
            },
            'leituras_periodo': {
                'dias': dias,
                'total': leituras_periodo,
                'tendencia': tendencia_leituras,
            },
            'leituras_por_mes': _leituras_por_mes(),
            'atividade_recente': LogAuditoriaSerializer(
                LogAuditoria.objects.select_related('ator')[:15], many=True,
            ).data,
            'integracoes': {
                'inmet': _checar_integracao('inmet', 'https://apitempo.inmet.gov.br/estacoes/T'),
                'ibge': _checar_integracao(
                    'ibge', 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/RJ/municipios',
                ),
                'open_meteo': _checar_integracao(
                    'open_meteo', 'https://api.open-meteo.com/v1/forecast',
                    params={'latitude': -22.92, 'longitude': -42.82, 'current_weather': 'true'},
                ),
                # Resend não tem um jeito de "pingar" a entrega de e-mail em
                # si — aqui só reporta se a chave está configurada no
                # ambiente (produção) ou se caiu no backend de console (dev).
                'resend': {'configurado': bool(os.environ.get('RESEND_API_KEY'))},
            },
            'ambiente': {
                'django_versao': django.get_version(),
                'python_versao': sys.version.split()[0],
                'debug': settings.DEBUG,
            },
        })


class LimparLeiturasAntigasView(APIView):
    """Zona de risco (menor que a de LimparDadosOperacionaisView): apaga
    só leituras mais velhas que `dias` — não mexe em contas, estações,
    nem no restante do histórico. Mesmo padrão de segurança das outras
    ações de apagar dado: GET é sempre só a prévia; POST só apaga com
    `{"confirmar": true}` no corpo."""

    permission_classes = [IsAuthenticated, EhGestor]

    def _dias(self, request):
        origem = request.query_params if request.method == 'GET' else request.data
        try:
            return max(int(origem.get('dias', 365)), 1)
        except (TypeError, ValueError):
            return 365

    def get(self, request):
        dias = self._dias(request)
        limite = timezone.now() - timezone.timedelta(days=dias)
        return Response({'dias': dias, 'quantidade': Leitura.objects.filter(data_hora__lt=limite).count()})

    def post(self, request):
        if request.data.get('confirmar') is not True:
            return Response(
                {'status': 'error', 'message': 'Envie {"confirmar": true} no corpo pra executar de verdade.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dias = self._dias(request)
        limite = timezone.now() - timezone.timedelta(days=dias)
        alvo = Leitura.objects.filter(data_hora__lt=limite)
        quantidade = alvo.count()
        alvo.delete()

        LogAuditoria.objects.create(
            ator=request.user, acao='manutencao.leituras_antigas_removidas',
            detalhes={'dias': dias, 'quantidade': quantidade},
        )
        return Response({'status': 'success', 'dias': dias, 'quantidade': quantidade})


class UsuarioViewSet(viewsets.ModelViewSet):
    """Cadastro de contas. Gestor (RN02) pode criar/editar/suspender/
    excluir qualquer Usuário e enxerga a lista inteira; um Usuário comum
    só enxerga e edita a si mesmo (RN08) — nunca a lista de outras
    contas."""

    serializer_class = UsuarioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Sem isso, UsuarioSerializer.plano_atual/plano_max_estacoes/
        # estacoes_vinculadas disparavam 3 queries A MAIS por linha (N+1)
        # — imperceptível no sqlite local, mas pesado de verdade contra o
        # Supabase em produção (cada query é uma viagem de rede). O
        # annotate resolve a contagem de estações numa query só; o
        # prefetch_related busca a assinatura ativa de todo mundo de uma
        # vez (`to_attr` guarda o resultado já filtrado/pronto na
        # instância, sem custo extra pra ler de novo depois).
        assinatura_ativa_qs = Assinatura.objects.filter(encerrada_em__isnull=True).select_related('plano')
        base = Usuario.objects.annotate(
            estacoes_vinculadas_count=Count('estacoes', distinct=True),
        ).prefetch_related(
            Prefetch('assinaturas', queryset=assinatura_ativa_qs, to_attr='assinatura_ativa_prefetch'),
        )

        user = self.request.user
        if user.eh_gestor:
            return base.order_by('username')
        return base.filter(pk=user.pk)

    def get_permissions(self):
        # 'suspender'/'reativar' também são Gestor-only (RN02) — precisam
        # estar aqui: este método sobrescreve get_permissions por
        # completo, então o `permission_classes=[...]` passado pro
        # @action (abaixo, em suspender/reativar) seria ignorado se não
        # fosse checado explicitamente. Sem isso, um Usuário comum
        # conseguia chamar a própria ação em si mesmo (get_object() já
        # restringe pra "si mesmo" quando não é Gestor).
        if self.action in ('list', 'create', 'destroy', 'suspender', 'reativar'):
            return [IsAuthenticated(), EhGestor()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """GET /api/contas/me/ — a própria conta, pra qualquer usuário
        autenticado (Gestor ou Usuário comum). Existe separado de `list`
        porque `list` fica reservado ao Gestor (RN02); um Usuário comum
        não pode chamar `list` pra ver a si mesmo, mesmo que o queryset já
        devolvesse só o próprio registro."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Só o Gestor chega aqui (create é Gestor-only, ver get_permissions)
        # — cadastro público passa por CadastroView, não por este ViewSet.
        usuario = serializer.save()
        LogAuditoria.objects.create(
            ator=self.request.user, acao='usuario.criado', alvo=usuario, detalhes=_identificar_usuario(usuario),
        )

    def perform_update(self, serializer):
        # RN08: só o Gestor pode alterar o `role` de uma conta (promover a
        # Gestor, por exemplo) — se quem edita não é Gestor, o campo é
        # descartado silenciosamente do payload antes de salvar.
        if not self.request.user.eh_gestor:
            serializer.validated_data.pop('role', None)
            serializer.validated_data.pop('is_active', None)
        serializer.save()

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError

        # Estacao.usuarios é M2M (RN15) — apagar a conta não quebraria
        # nada tecnicamente (só sumiria o vínculo), mas excluir uma conta
        # que ainda enxerga estação(ões) sem avisar seria uma surpresa
        # ruim pro Gestor. Trava aqui com mensagem clara: primeiro
        # desvincula, depois exclui.
        if instance.estacoes.exists():
            raise ValidationError(
                {'detail': 'Esta conta ainda tem estação(ões) vinculada(s). Transfira ou remova antes de excluir.'}
            )

        LogAuditoria.objects.create(
            ator=self.request.user, acao='usuario.excluido', alvo=instance,
            detalhes={'username': instance.username},
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def suspender(self, request, pk=None):
        """RN02: Gestor pode suspender uma conta (sem excluí-la)."""
        usuario = self.get_object()
        usuario.is_active = False
        usuario.save(update_fields=['is_active'])
        LogAuditoria.objects.create(
            ator=request.user, acao='usuario.suspenso', alvo=usuario, detalhes=_identificar_usuario(usuario),
        )
        return Response({'status': 'success', 'is_active': usuario.is_active})

    @action(detail=True, methods=['post'])
    def reativar(self, request, pk=None):
        usuario = self.get_object()
        usuario.is_active = True
        usuario.save(update_fields=['is_active'])
        LogAuditoria.objects.create(
            ator=request.user, acao='usuario.reativado', alvo=usuario, detalhes=_identificar_usuario(usuario),
        )
        return Response({'status': 'success', 'is_active': usuario.is_active})


class FuncionalidadeViewSet(viewsets.ModelViewSet):
    """Catálogo de recursos liberáveis por plano — só o Gestor mexe aqui
    (RN24: reclassificar recursos entre planos sem precisar de deploy)."""

    queryset = Funcionalidade.objects.all()
    serializer_class = FuncionalidadeSerializer
    permission_classes = [IsAuthenticated, EhGestor]


class PlanoViewSet(viewsets.ModelViewSet):
    """Níveis de conta (Standard/Pro/Plus). Listagem é PÚBLICA (sem login)
    — é o que alimenta os cards de preço da tela de cadastro, antes de
    existir qualquer sessão; não expõe nada sensível, só nome/preço/
    limites/recursos, a mesma coisa que uma página de preços mostraria.
    Só o Gestor pode criar/editar/remover planos (RN04)."""

    queryset = Plano.objects.prefetch_related('funcionalidades').all()
    serializer_class = PlanoSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), EhGestor()]


class AssinaturaViewSet(viewsets.ModelViewSet):
    """Histórico de vínculo Usuário↔Plano (RN25). Um Usuário comum só vê
    e cria assinaturas para si mesmo; o Gestor vê e altera de qualquer
    conta (RN03), inclusive marcando `origem=gestor` para deixar claro no
    histórico que a troca não veio de autoatendimento.

    A troca de plano em si (não o CRUD genérico) é feita pela action
    `trocar_plano`, que aplica RN25/RN26: encerra a assinatura ativa
    anterior e cria uma nova, e impede reassinar o mesmo plano já ativo.
    A integração de pagamento real (gateway externo) fica fora deste
    endpoint — aqui só é tratado o registro de qual plano vale a partir
    de agora.
    """

    serializer_class = AssinaturaSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']  # sem PUT/PATCH/DELETE: histórico é imutável

    def get_queryset(self):
        user = self.request.user
        qs = Assinatura.objects.select_related('usuario', 'plano')
        return qs if user.eh_gestor else qs.filter(usuario=user)

    @action(detail=False, methods=['post'])
    def trocar_plano(self, request):
        plano_id = request.data.get('plano')
        usuario_id = request.data.get('usuario')

        if usuario_id and not request.user.eh_gestor:
            return Response(
                {'status': 'error', 'message': 'Só o Gestor pode alterar o plano de outra conta.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        usuario = Usuario.objects.filter(pk=usuario_id).first() if usuario_id else request.user
        if usuario is None:
            return Response({'status': 'error', 'message': 'Usuário não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        plano = Plano.objects.filter(pk=plano_id, ativo=True).first()
        if plano is None:
            return Response({'status': 'error', 'message': 'Plano não encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        atual = Assinatura.objects.filter(usuario=usuario, encerrada_em__isnull=True).first()
        if atual is not None and atual.plano_id == plano.id:
            # RN26: impede assinar novamente o plano ao qual já está vinculado.
            return Response(
                {'status': 'error', 'message': 'Você já está no plano selecionado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if atual is not None:
            # RN25: downgrade/troca mantém o histórico de dados coletado —
            # aqui só encerramos o VÍNCULO de plano, nenhum dado de
            # telemetria é tocado (Leitura/Estacao não referenciam Assinatura).
            atual.status = Assinatura.Status.CANCELADA
            atual.encerrada_em = timezone.now()
            atual.save(update_fields=['status', 'encerrada_em'])

        origem = Assinatura.Origem.GESTOR if (usuario_id and request.user.eh_gestor) else Assinatura.Origem.AUTOATENDIMENTO
        nova = Assinatura.objects.create(usuario=usuario, plano=plano, origem=origem)

        if origem == Assinatura.Origem.GESTOR:
            LogAuditoria.objects.create(
                ator=request.user, acao='plano.alterado', alvo=usuario,
                detalhes={
                    **_identificar_usuario(usuario),
                    'plano': plano.nome,
                    'plano_anterior': atual.plano.nome if atual is not None else None,
                },
            )

        return Response(AssinaturaSerializer(nova).data, status=status.HTTP_201_CREATED)
