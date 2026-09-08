import logging

from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

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
            ator=request.user, acao='usuario.suspenso', alvo=usuario,
        )
        return Response({'status': 'success', 'is_active': usuario.is_active})

    @action(detail=True, methods=['post'])
    def reativar(self, request, pk=None):
        usuario = self.get_object()
        usuario.is_active = True
        usuario.save(update_fields=['is_active'])
        LogAuditoria.objects.create(
            ator=request.user, acao='usuario.reativado', alvo=usuario,
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
                detalhes={'plano': plano.nome},
            )

        return Response(AssinaturaSerializer(nova).data, status=status.HTTP_201_CREATED)
