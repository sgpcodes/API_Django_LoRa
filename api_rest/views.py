from django.contrib.auth import get_user_model
from django.db import DatabaseError, connections
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AcessoEstacao,
    Estacao,
    EstadoSincronizacao,
    Leitura,
    SolicitacaoRssi,
    aplicar_restricao_variaveis,
    mapa_variaveis_liberadas,
)
from .permissions import EhGestor, EhGestorOuDonoDaEstacao
from .serializers import EstacaoSerializer, LeituraSerializer, _leitura_resumo
from .validacao import detectar_inconsistencia

Usuario = get_user_model()

# Sensor que mandou leitura há mais tempo que isso, sem nunca ter virado
# uma Estacao cadastrada, provavelmente não está mais em uso — some da
# lista de "órfãos" do admin em vez de acumular pra sempre.
JANELA_SENSORES_ORFAOS = timezone.timedelta(days=7)


def _leitura_para_dict(leitura):
    """Converte uma Leitura (model) num dict serializável em JSON, com o
    mesmo formato de campos usado desde a época do MongoDB — `estacao_id`
    e `inconsistente` são campos novos, adicionados no final, então não
    quebram nenhum consumidor que já lê os campos antigos por nome."""
    return {
        'id': leitura.id,
        'sensor_id': leitura.sensor_id,
        'temperatura': leitura.temperatura,
        'umidade': leitura.umidade,
        'pressao': leitura.pressao,
        'dados_adicionais': leitura.dados_adicionais,
        'data_hora': leitura.data_hora,
        'estacao_id': leitura.estacao_id,
        'inconsistente': leitura.inconsistente,
    }


class LeituraListCreateView(APIView):
    """GET: lista as leituras (com filtro opcional por sensor_id) — exige
    login; um Usuário comum só vê leituras das estações vinculadas a ele
    (RN06/RN07), o Gestor vê tudo (RN01).
    POST: recebe uma leitura da ESP32 receptora — continua aberto
    (AllowAny), porque o dispositivo ainda não manda nenhum token (isso é
    uma fase futura, de firmware)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        sensor_id = request.query_params.get('sensor_id')
        desde = parse_date(request.query_params.get('desde') or '')
        ate = parse_date(request.query_params.get('ate') or '')

        # Filtro construído aqui como dict para facilitar a futura adição de
        # filtros por período (hoje, ontem, últimos 7/30 dias, intervalo
        # personalizado), que também vão compor esse mesmo `filtro`.
        filtro = {'sensor_id': sensor_id} if sensor_id else {}
        if desde:
            filtro['data_hora__date__gte'] = desde
        if ate:
            filtro['data_hora__date__lte'] = ate

        leituras = Leitura.objects.filter(**filtro).order_by('-data_hora')
        if not request.user.eh_gestor:
            leituras = leituras.filter(estacao__usuarios=request.user)

        dados = [_leitura_para_dict(leitura) for leitura in leituras]

        # RF-02/RF-03: Gestor nunca é restrito (RN01, vê tudo); conta
        # comum só vê a variável que o Gestor liberou pra ela NAQUELA
        # estação (AcessoEstacao) — card continua aparecendo, só o dado
        # vem zerado (ver aplicar_restricao_variaveis).
        if not request.user.eh_gestor:
            mapa = mapa_variaveis_liberadas(request.user)
            for item in dados:
                liberadas = mapa.get(item['estacao_id'])
                if liberadas is not None:
                    aplicar_restricao_variaveis(item, liberadas)

        return Response(dados)

    def post(self, request):
        serializer = LeituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        # RN15/shim: liga a leitura à Estacao já cadastrada com esse
        # identificador, se existir. Se não existir ainda, a leitura é
        # salva do mesmo jeito, sem estação (como sempre foi) — o POST do
        # ESP32 nunca falha por causa disso.
        estacao = Estacao.objects.filter(identificador=dados['sensor_id']).first()

        # RN18: sinaliza valores fora de faixa plausível, mas não rejeita.
        inconsistente, motivo = detectar_inconsistencia(
            dados['temperatura'], dados['umidade'], dados.get('pressao'),
        )

        try:
            leitura = Leitura.objects.create(
                **dados, estacao=estacao, inconsistente=inconsistente, motivo_inconsistencia=motivo,
            )
        except DatabaseError:
            return Response(
                {'status': 'error', 'message': 'Não foi possível salvar a leitura.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if estacao is not None:
            # RN16: registra o horário da última transmissão recebida.
            estacao.ultima_transmissao_em = leitura.data_hora
            estacao.save(update_fields=['ultima_transmissao_em'])

        # Se essa leitura veio com o resultado de uma análise de RSSI/SNR
        # (rssi_ida em dados_adicionais), o pedido pendente desse sensor foi
        # atendido — limpa a flag para o RX parar de consultar esse rádio.
        if 'rssi_ida' in leitura.dados_adicionais:
            solicitacao = SolicitacaoRssi.obter(leitura.sensor_id)
            if solicitacao.pendente:
                solicitacao.pendente = False
                solicitacao.save(update_fields=['pendente', 'atualizado_em'])

        return Response(
            {'status': 'success', 'message': 'Leitura salva com sucesso.'},
            status=status.HTTP_201_CREATED,
        )


class EstadoSincronizacaoView(APIView):
    """GET: o dashboard consulta isso pra mostrar o aviso de "operando
    offline" quando esta instalação é uma Raspberry Pi com backup local
    (CLOUD_DATABASE_URL configurada) e a última tentativa de
    sincronização não conseguiu falar com a nuvem. Em qualquer outra
    instalação (Render, sem sincronização configurada),
    `sincronizacao_configurada` vem False e o resto é ignorado — não
    existe conceito de "offline" nesse caso."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        configurada = 'nuvem' in connections.databases
        if not configurada:
            return Response({'sincronizacao_configurada': False})

        estado = EstadoSincronizacao.atual()
        return Response({
            'sincronizacao_configurada': True,
            'nuvem_alcancavel': estado.nuvem_alcancavel,
            'ultima_tentativa_em': estado.ultima_tentativa_em,
            'ultima_sincronizacao_com_sucesso_em': estado.ultima_sincronizacao_com_sucesso_em,
            'leituras_pendentes': Leitura.objects.using('default').count(),
        })


class RssiStatusView(APIView):
    """GET: o RX consulta em cada check-in se há algum pedido de análise
    pendente e, se houver, para qual sensor — o RX so processa um pedido
    por vez, entao devolve sempre o mais antigo pendente.

    Continua aberto (AllowAny): é o hardware quem chama, sem token."""

    permission_classes = [AllowAny]

    def get(self, request):
        solicitacao = SolicitacaoRssi.proxima_pendente()
        if solicitacao is None:
            return Response({'pendente': False})
        return Response({'pendente': True, 'sensor_id': solicitacao.sensor_id})


class RssiSolicitarView(APIView):
    """POST: o botão "Analisar" do dashboard chama isso, indicando pra qual
    sensor (campo "sensor_id" no corpo), pra marcar um pedido como
    pendente. Exige login — é uma ação do Usuário/Gestor, não do
    dispositivo — e, para Usuário comum, só é permitido pedir análise de
    uma estação vinculada a ele (RN07)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        sensor_id = request.data.get('sensor_id')
        if not sensor_id:
            return Response(
                {'status': 'error', 'message': 'Campo "sensor_id" é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not request.user.eh_gestor:
            estacao = Estacao.objects.filter(identificador=sensor_id).first()
            if estacao is None or not estacao.usuarios.filter(pk=request.user.pk).exists():
                return Response(
                    {'status': 'error', 'message': 'Estação não encontrada ou não vinculada à sua conta.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        solicitacao = SolicitacaoRssi.obter(sensor_id)
        solicitacao.pendente = True
        solicitacao.save(update_fields=['pendente', 'atualizado_em'])
        return Response(
            {'status': 'success', 'pendente': True, 'sensor_id': sensor_id},
            status=status.HTTP_201_CREATED,
        )


class LeituraDetailView(APIView):
    """GET: busca uma leitura específica pelo seu ID. Exige login; um
    Usuário comum só pode ver uma leitura de uma estação vinculada a ele
    (RN06/RN07)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, leitura_id):
        try:
            leitura = Leitura.objects.get(pk=leitura_id)
        except (Leitura.DoesNotExist, ValueError):
            return Response(
                {'erro': 'Leitura não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not request.user.eh_gestor:
            if leitura.estacao_id is None or not leitura.estacao.usuarios.filter(pk=request.user.pk).exists():
                return Response(
                    {'erro': 'Leitura não encontrada.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        return Response(_leitura_para_dict(leitura))


class EstacaoViewSet(viewsets.ModelViewSet):
    """CRUD de Estações. Cadastro/remoção é exclusivo do Gestor (RN02,
    RN14, RN15 — vincular contas a uma estação é um ato de cadastro, não
    uma ação do próprio Usuário final); leitura e edição de configurações
    (ex.: intervalo de envio) já podem ser feitas por qualquer conta
    vinculada."""

    serializer_class = EstacaoSerializer

    def get_queryset(self):
        from contas.models import Assinatura

        # prefetch_related('usuarios'): sem isso, EstacaoSerializer.
        # usuarios_info disparava 1 query extra por estação (N+1) pra
        # buscar as contas vinculadas. O segundo Prefetch cobre a mesma
        # coisa pro plano de cada uma (mesmo problema de N+1 que já
        # corrigimos em contas/views.py:UsuarioViewSet) — como agora é
        # "usuários", não "usuário", o prefetch é sobre cada um deles via
        # `to_attr` no relacionamento reverso de Assinatura.
        assinatura_ativa_qs = Assinatura.objects.filter(encerrada_em__isnull=True).select_related('plano')
        queryset = Estacao.objects.prefetch_related(
            Prefetch('usuarios', queryset=Usuario.objects.prefetch_related(
                Prefetch('assinaturas', queryset=assinatura_ativa_qs, to_attr='assinatura_ativa_prefetch'),
            )),
        )
        user = self.request.user
        if user.eh_gestor:
            return queryset
        return queryset.filter(usuarios=user)

    def _atualizar_online_se_necessario(self, estacoes):
        """Busca uma leitura nova da Open-Meteo pra cada Estacao online
        cujo dado está mais velho que o próprio `intervalo_envio_minutos`
        dela (1h por padrão — ver EstacaoSerializer.validate; o mesmo
        critério de "precisa atualizar" do loop de fundo, reaproveitado
        daqui, ver coletar_dados_online.py) — direto na hora em que a
        lista/detalhe é consultado, sem depender só do loop rodando a
        tempo. Com isso, abrir a tela de Estações, o Dashboard do
        Usuário ou a tela de Contas sempre força o dado mais novo
        possível pra estação online, mesmo que o loop ainda não tenha
        passado por ela.

        Silencioso de propósito (uma Open-Meteo fora do ar não pode
        quebrar a tela toda, igual o loop de fundo já faz) — pior caso,
        a estação continua mostrando o último dado que tinha."""
        from django.db import DatabaseError
        from requests import RequestException

        from .management.commands.coletar_dados_online import coletar_estacao, precisa_atualizar

        for estacao in estacoes:
            if not precisa_atualizar(estacao):
                continue
            try:
                coletar_estacao(estacao)
            except (RequestException, DatabaseError):
                pass

    def list(self, request, *args, **kwargs):
        self._atualizar_online_se_necessario(self.get_queryset())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._atualizar_online_se_necessario([self.get_object()])
        return super().retrieve(request, *args, **kwargs)

    def get_permissions(self):
        # 'orfas' também é Gestor-only (RN01) — precisa estar aqui: este
        # método é uma sobrescrita completa de get_permissions, então o
        # `permission_classes=[...]` passado pro @action abaixo (em
        # `orfas`) seria ignorado se não fosse checado explicitamente.
        if self.action in ('create', 'destroy', 'orfas', 'atualizar_dados_online', 'variaveis_liberadas'):
            return [IsAuthenticated(), EhGestor()]
        if self.action in ('retrieve', 'update', 'partial_update'):
            return [IsAuthenticated(), EhGestorOuDonoDaEstacao()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        from django.core.management import call_command

        from contas.models import LogAuditoria

        # RN15: quem cadastra escolhe quais contas ficam vinculadas.
        estacao = serializer.save()
        detalhes = {'identificador': estacao.identificador, 'usuarios_ids': list(estacao.usuarios.values_list('id', flat=True))}

        if estacao.tipo == Estacao.Tipo.ONLINE:
            # Backfill síncrono (uma chamada à Open-Meteo + bulk_create) —
            # não existe fila de tarefas no projeto, e isso leva poucos
            # segundos. Falha aqui não deve impedir a estação de ser criada
            # (fica sem histórico até alguém rodar o comando de novo na mão).
            try:
                call_command('backfill_historico_estacao', str(estacao.id))
                # O comando atualiza `ultima_transmissao_em` numa instância
                # própria (outra query) — sem isso, a resposta deste mesmo
                # request ainda mostraria o valor antigo (null).
                estacao.refresh_from_db()
                detalhes['backfill'] = 'ok'
            except Exception as erro:
                detalhes['backfill'] = f'falhou: {erro}'

        LogAuditoria.objects.create(ator=self.request.user, acao='estacao.criada', alvo=estacao, detalhes=detalhes)

    def perform_update(self, serializer):
        from contas.models import LogAuditoria

        # Só o Gestor pode mudar as contas vinculadas (RN15) — se quem
        # edita é uma das contas da própria estação, o campo é descartado
        # silenciosamente do payload antes de salvar (ela continua podendo
        # editar o resto: nome, intervalo de envio etc.).
        if not self.request.user.eh_gestor:
            serializer.validated_data.pop('usuarios', None)

        usuarios_antes = set(serializer.instance.usuarios.values_list('id', flat=True))
        estacao = serializer.save()
        usuarios_depois = set(estacao.usuarios.values_list('id', flat=True))

        if usuarios_antes != usuarios_depois:
            LogAuditoria.objects.create(
                ator=self.request.user, acao='estacao.usuarios_alterados', alvo=estacao,
                detalhes={
                    'identificador': estacao.identificador,
                    'usuarios_antes': sorted(usuarios_antes),
                    'usuarios_depois': sorted(usuarios_depois),
                },
            )

    def perform_destroy(self, instance):
        from contas.models import LogAuditoria

        LogAuditoria.objects.create(
            ator=self.request.user, acao='estacao.excluida',
            detalhes={'identificador': instance.identificador, 'id': instance.id},
        )
        instance.delete()

    @action(detail=True, methods=['post'])
    def atualizar_dados_online(self, request, pk=None):
        """POST /api/estacoes/<id>/atualizar_dados_online/ — gatilho manual
        pro Gestor usar quando precisa de dado AGORA. Só roda o backfill
        de 30 dias (pesado — 1 chamada grande à Open-Meteo) na PRIMEIRA
        vez, quando a estação ainda não tem nenhuma Leitura; clicar de
        novo depois só busca a leitura atual (1 chamada pequena), não o
        histórico inteiro outra vez — repetir o backfill a cada clique
        não trazia nada de novo (idempotente no banco) mas gastava cota
        da Open-Meteo à toa, e foi exatamente isso que nos rendeu um 429
        (Too Many Requests) num teste. Também busca só ESTA estação, não
        `coletar_dados_online` (que varre todas as online de uma vez).

        POST {"forcar_backfill": true} refaz o backfill de 30 dias mesmo
        já tendo Leitura — pro caso de uma estação ter nascido durante
        um bloqueio da Open-Meteo (backfill falhou silenciosamente na
        criação, mas a estação foi criada do mesmo jeito) e só ter
        histórico curto, do período em que o loop normal já rodou."""
        from django.core.management import call_command

        from .management.commands.coletar_dados_online import coletar_estacao

        estacao = self.get_object()
        if estacao.tipo != Estacao.Tipo.ONLINE:
            return Response(
                {'status': 'error', 'message': 'Só estações tipo=online têm dados pra atualizar desta forma.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if request.data.get('forcar_backfill') or not estacao.leituras.exists():
                call_command('backfill_historico_estacao', str(estacao.id))
            coletar_estacao(estacao)
        except Exception as erro:
            return Response({'status': 'error', 'message': str(erro)}, status=status.HTTP_502_BAD_GATEWAY)

        estacao.refresh_from_db()
        return Response({'status': 'success', 'ultima_transmissao_em': estacao.ultima_transmissao_em})

    @action(detail=True, methods=['patch'], url_path='acesso/(?P<usuario_id>[^/.]+)')
    def variaveis_liberadas(self, request, pk=None, usuario_id=None):
        """PATCH /api/estacoes/<id>/acesso/<usuario_id>/ {"variaveis_liberadas": [...]}
        — só o Gestor decide quais variáveis uma conta vê de uma estação
        específica dela (RF-02/RF-03). Lista vazia é válida (RN: conta sem
        nenhuma variável liberada daquela estação, não um erro) — só o que
        não é um subconjunto de AcessoEstacao.VARIAVEIS é rejeitado."""
        estacao = self.get_object()
        usuario = get_object_or_404(Usuario, pk=usuario_id)
        if not estacao.usuarios.filter(pk=usuario.pk).exists():
            return Response(
                {'status': 'error', 'message': 'Essa conta não está vinculada a esta estação.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variaveis = request.data.get('variaveis_liberadas')
        if not isinstance(variaveis, list) or not set(variaveis).issubset(AcessoEstacao.VARIAVEIS):
            return Response(
                {'status': 'error', 'message': f'variaveis_liberadas precisa ser uma lista dentro de {AcessoEstacao.VARIAVEIS}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        acesso, _criado = AcessoEstacao.objects.update_or_create(
            usuario=usuario, estacao=estacao, defaults={'variaveis_liberadas': variaveis},
        )
        return Response({'status': 'success', 'variaveis_liberadas': acesso.variaveis_liberadas})

    @action(detail=False, methods=['get'])
    def orfas(self, request):
        """GET /api/estacoes/orfas/ — sensor_id que já mandaram leitura mas
        ainda não viraram uma Estacao cadastrada (RN15: toda Estacao tem
        pelo menos uma conta vinculada, então "órfão" aqui é sempre a
        leitura crua, nunca a Estacao em si). É esta lista que alimenta o
        "atribuir a um usuário" na tela de Contas do admin."""
        identificadores_cadastrados = set(Estacao.objects.values_list('identificador', flat=True))
        desde = timezone.now() - JANELA_SENSORES_ORFAOS

        leituras_recentes = Leitura.objects.filter(
            estacao__isnull=True, data_hora__gte=desde,
        ).order_by('-data_hora')

        vistos = set()
        orfaos = []
        for leitura in leituras_recentes:
            if leitura.sensor_id in identificadores_cadastrados or leitura.sensor_id in vistos:
                continue
            vistos.add(leitura.sensor_id)
            orfaos.append({'sensor_id': leitura.sensor_id, 'ultima_leitura': _leitura_resumo(leitura)})

        return Response(orfaos)


class LeiturasOrfasPorSensorView(APIView):
    """DELETE /api/leituras/orfas/<sensor_id>/ — apaga todas as leituras
    cruas de um sensor_id que nunca virou uma Estacao cadastrada (dado de
    teste, sensor com identificador errado etc.). Só atinge leituras SEM
    estação vinculada — nunca mexe no histórico de uma Estacao de verdade
    (pra isso existe a tela de Manutenção, que é intencionalmente mais
    burocrática por ser bem mais destrutiva)."""

    permission_classes = [IsAuthenticated, EhGestor]

    def delete(self, request, sensor_id):
        from contas.models import LogAuditoria

        leituras = Leitura.objects.filter(sensor_id=sensor_id, estacao__isnull=True)
        total = leituras.count()
        if total == 0:
            return Response(
                {'status': 'error', 'message': 'Nenhuma leitura órfã encontrada para esse sensor.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        leituras.delete()
        SolicitacaoRssi.objects.filter(sensor_id=sensor_id, estacao__isnull=True).delete()

        LogAuditoria.objects.create(
            ator=request.user, acao='leituras_orfas.excluidas',
            detalhes={'sensor_id': sensor_id, 'quantidade': total},
        )
        return Response({'status': 'success', 'quantidade': total})
