from django.db import models


class SolicitacaoRssi(models.Model):
    """
    Flag simples e global (o sistema tem apenas um sensor/rádio) indicando
    se há um pedido de análise de RSSI/SNR pendente. O ESP32 receptor
    consulta essa flag a cada check-in (GET /api/rssi/status/) e, se
    estiver pendente, consulta o rádio via LoRa e envia o resultado junto
    da próxima leitura — que por sua vez limpa a flag automaticamente.
    """

    pendente = models.BooleanField(default=False)
    atualizado_em = models.DateTimeField(auto_now=True)

    @classmethod
    def obter(cls):
        """Sempre a mesma linha (id=1) — não há uma por sensor porque só existe um."""
        solicitacao, _ = cls.objects.get_or_create(pk=1)
        return solicitacao

    def __str__(self):
        return 'pendente' if self.pendente else 'sem pedido pendente'


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
