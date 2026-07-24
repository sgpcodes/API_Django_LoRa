from django.db import models


class Leitura(models.Model):
    """Uma leitura de temperatura/umidade enviada pela ESP32 receptora."""

    sensor_id = models.CharField(max_length=100)
    temperatura = models.FloatField()
    umidade = models.FloatField()
    pressao = models.FloatField(null=True, blank=True)
    dados_adicionais = models.JSONField(default=dict, blank=True)
    data_hora = models.DateTimeField()

    class Meta:
        ordering = ['-data_hora']

    def __str__(self):
        return f'{self.sensor_id} — {self.temperatura}°C / {self.umidade}% ({self.data_hora})'
