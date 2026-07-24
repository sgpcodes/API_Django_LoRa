from rest_framework import serializers
from django.utils import timezone

from .models import Leitura


class LeituraSerializer(serializers.ModelSerializer):
    """
    Valida os dados de uma leitura meteorológica antes de salvar no banco.

    A ESP32 receptora envia a chave "sensor" no JSON (não "sensor_id"), então
    mapeamos aqui para o campo do model.
    """
    sensor = serializers.CharField(max_length=100, source='sensor_id')

    # A ESP32 não envia data/hora: se não vier no payload, usamos o
    # momento em que a leitura chegou na API.
    data_hora = serializers.DateTimeField(required=False, default=timezone.now)

    class Meta:
        model = Leitura
        fields = ['id', 'sensor', 'temperatura', 'umidade', 'pressao', 'dados_adicionais', 'data_hora']
        read_only_fields = ['id']
