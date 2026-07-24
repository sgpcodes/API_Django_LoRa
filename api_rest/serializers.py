from rest_framework import serializers
from django.utils import timezone


class LeituraSerializer(serializers.Serializer):
    """
    Valida os dados de uma leitura meteorológica antes de salvar no MongoDB.

    Usamos "serializers.Serializer" porque a leitura é salva diretamente
    em uma coleção do MongoDB e não como um model do Django.
    """
    id = serializers.CharField(read_only=True)

    # A ESP32 receptora envia a chave "sensor" no JSON, mas guardamos como
    # "sensor_id" porque é o nome que o frontend (leiturasService.js,
    # Dashboard.jsx) já espera nos dados vindos da API.
    sensor = serializers.CharField(max_length=100, source='sensor_id')
    temperatura = serializers.FloatField()
    umidade = serializers.FloatField()
    pressao = serializers.FloatField(required=False)
    dados_adicionais = serializers.DictField(required=False, default=dict)

    # A ESP32 não envia data/hora: se não vier no payload, usamos o
    # momento em que a leitura chegou na API. Guardado como "data_hora"
    # pelo mesmo motivo (é o campo que o frontend já lê).
    data_hora = serializers.DateTimeField(required=False, default=timezone.now)
