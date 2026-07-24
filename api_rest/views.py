from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import PyMongoError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mongo import get_collection
from .serializers import LeituraSerializer


def _documento_para_dict(documento):
    """Converte um documento do MongoDB para um dict serializável em JSON."""
    documento['id'] = str(documento['_id'])
    del documento['_id']
    return documento


class LeituraListCreateView(APIView):
    """GET: lista as leituras (com filtro opcional por sensor_id). POST: recebe uma leitura da ESP32 receptora."""

    def get(self, request):
        sensor_id = request.query_params.get('sensor_id')

        # Filtro construído aqui como dict para facilitar a futura adição de
        # filtros por período (hoje, ontem, últimos 7/30 dias, intervalo
        # personalizado), que também vão compor esse mesmo `filtro`.
        filtro = {'sensor_id': sensor_id} if sensor_id else {}

        collection = get_collection()
        leituras = collection.find(filtro).sort('data_hora', -1)

        dados = [_documento_para_dict(leitura) for leitura in leituras]
        return Response(dados)

    def post(self, request):
        serializer = LeituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            collection = get_collection()
            collection.insert_one(dict(serializer.validated_data))
        except PyMongoError:
            return Response(
                {'status': 'error', 'message': 'Não foi possível salvar a leitura.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {'status': 'success', 'message': 'Leitura salva com sucesso.'},
            status=status.HTTP_201_CREATED,
        )


class LeituraDetailView(APIView):
    """GET: busca uma leitura específica pelo seu ID."""

    def get(self, request, leitura_id):
        try:
            object_id = ObjectId(leitura_id)
        except InvalidId:
            return Response(
                {'erro': 'ID inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        collection = get_collection()
        leitura = collection.find_one({'_id': object_id})

        if leitura is None:
            return Response(
                {'erro': 'Leitura não encontrada.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(_documento_para_dict(leitura))
