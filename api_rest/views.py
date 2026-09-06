from django.db import DatabaseError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Estacao, Leitura, SolicitacaoRssi
from .permissions import EhGestor, EhGestorOuDonoDaEstacao
from .serializers import EstacaoSerializer, LeituraSerializer, _leitura_resumo
from .validacao import detectar_inconsistencia

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

        # Filtro construído aqui como dict para facilitar a futura adição de
        # filtros por período (hoje, ontem, últimos 7/30 dias, intervalo
        # personalizado), que também vão compor esse mesmo `filtro`.
        filtro = {'sensor_id': sensor_id} if sensor_id else {}

        leituras = Leitura.objects.filter(**filtro).order_by('-data_hora')
        if not request.user.eh_gestor:
            leituras = leituras.filter(estacao__dono=request.user)

        dados = [_leitura_para_dict(leitura) for leitura in leituras]
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
            if estacao is None or estacao.dono_id != request.user.id:
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
            if leitura.estacao_id is None or leitura.estacao.dono_id != request.user.id:
                return Response(
                    {'erro': 'Leitura não encontrada.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        return Response(_leitura_para_dict(leitura))


class EstacaoViewSet(viewsets.ModelViewSet):
    """CRUD de Estações. Cadastro/remoção é exclusivo do Gestor (RN02,
    RN14, RN15 — vincular uma estação a um dono é um ato de cadastro, não
    uma ação do próprio Usuário final); leitura e edição de configurações
    (ex.: intervalo de envio) já podem ser feitas pelo dono."""

    serializer_class = EstacaoSerializer

    def get_queryset(self):
        user = self.request.user
        if user.eh_gestor:
            return Estacao.objects.all()
        return Estacao.objects.filter(dono=user)

    def get_permissions(self):
        # 'orfas' também é Gestor-only (RN01) — precisa estar aqui: este
        # método é uma sobrescrita completa de get_permissions, então o
        # `permission_classes=[...]` passado pro @action abaixo (em
        # `orfas`) seria ignorado se não fosse checado explicitamente.
        if self.action in ('create', 'destroy', 'orfas'):
            return [IsAuthenticated(), EhGestor()]
        if self.action in ('retrieve', 'update', 'partial_update'):
            return [IsAuthenticated(), EhGestorOuDonoDaEstacao()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        from contas.models import LogAuditoria

        # RN15: quem cadastra escolhe o dono (o serializer já resolve o
        # default pra quem está autenticado, se `dono` não vier no payload).
        estacao = serializer.save()
        LogAuditoria.objects.create(
            ator=self.request.user, acao='estacao.criada', alvo=estacao,
            detalhes={'identificador': estacao.identificador, 'dono_id': estacao.dono_id},
        )

    def perform_update(self, serializer):
        from contas.models import LogAuditoria

        # Só o Gestor pode trocar o dono (RN15) — se quem edita é o
        # próprio dono da estação, o campo é descartado silenciosamente do
        # payload antes de salvar (ele continua podendo editar o resto:
        # nome, intervalo de envio etc.).
        if not self.request.user.eh_gestor:
            serializer.validated_data.pop('dono', None)

        dono_anterior_id = serializer.instance.dono_id
        estacao = serializer.save()

        if estacao.dono_id != dono_anterior_id:
            LogAuditoria.objects.create(
                ator=self.request.user, acao='estacao.dono_alterado', alvo=estacao,
                detalhes={
                    'identificador': estacao.identificador,
                    'dono_anterior_id': dono_anterior_id,
                    'dono_novo_id': estacao.dono_id,
                },
            )

    def perform_destroy(self, instance):
        from contas.models import LogAuditoria

        LogAuditoria.objects.create(
            ator=self.request.user, acao='estacao.excluida',
            detalhes={'identificador': instance.identificador, 'id': instance.id},
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def orfas(self, request):
        """GET /api/estacoes/orfas/ — sensor_id que já mandaram leitura mas
        ainda não viraram uma Estacao cadastrada (RN15: toda Estacao tem
        dono, então "órfão" aqui é sempre a leitura crua, nunca a Estacao
        em si). É esta lista que alimenta o "atribuir a um usuário" na
        tela de Contas do admin."""
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
