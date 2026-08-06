from django.db import DatabaseError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Leitura, SolicitacaoRssi
from .serializers import LeituraSerializer


def _leitura_para_dict(leitura):
    """Converte uma Leitura (model) num dict serializável em JSON, com o
    mesmo formato de campos usado desde a época do MongoDB."""
    return {
        'id': leitura.id,
        'sensor_id': leitura.sensor_id,
        'temperatura': leitura.temperatura,
        'umidade': leitura.umidade,
        'pressao': leitura.pressao,
        'dados_adicionais': leitura.dados_adicionais,
        'data_hora': leitura.data_hora,
    }


class LeituraListCreateView(APIView):
    """GET: lista as leituras (com filtro opcional por sensor_id). POST: recebe uma leitura da ESP32 receptora."""

    def get(self, request):
        sensor_id = request.query_params.get('sensor_id')

        # Filtro construído aqui como dict para facilitar a futura adição de
        # filtros por período (hoje, ontem, últimos 7/30 dias, intervalo
        # personalizado), que também vão compor esse mesmo `filtro`.
        filtro = {'sensor_id': sensor_id} if sensor_id else {}

        leituras = Leitura.objects.filter(**filtro).order_by('-data_hora')

        dados = [_leitura_para_dict(leitura) for leitura in leituras]
        return Response(dados)

    def post(self, request):
        serializer = LeituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            leitura = Leitura.objects.create(**serializer.validated_data)
        except DatabaseError:
            return Response(
                {'status': 'error', 'message': 'Não foi possível salvar a leitura.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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
    por vez, entao devolve sempre o mais antigo pendente."""

    def get(self, request):
        solicitacao = SolicitacaoRssi.proxima_pendente()
        if solicitacao is None:
            return Response({'pendente': False})
        return Response({'pendente': True, 'sensor_id': solicitacao.sensor_id})


class RssiSolicitarView(APIView):
    """POST: o botão "Analisar" do dashboard chama isso, indicando pra qual
    sensor (campo "sensor_id" no corpo), pra marcar um pedido como pendente."""

    def post(self, request):
        sensor_id = request.data.get('sensor_id')
        if not sensor_id:
            return Response(
                {'status': 'error', 'message': 'Campo "sensor_id" é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        solicitacao = SolicitacaoRssi.obter(sensor_id)
        solicitacao.pendente = True
        solicitacao.save(update_fields=['pendente', 'atualizado_em'])
        return Response(
            {'status': 'success', 'pendente': True, 'sensor_id': sensor_id},
            status=status.HTTP_201_CREATED,
        )


class LeituraDetailView(APIView):
    """GET: busca uma leitura específica pelo seu ID."""

    def get(self, request, leitura_id):
        try:
            leitura = Leitura.objects.get(pk=leitura_id)
        except (Leitura.DoesNotExist, ValueError):
            return Response(
                {'erro': 'Leitura não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(_leitura_para_dict(leitura))
