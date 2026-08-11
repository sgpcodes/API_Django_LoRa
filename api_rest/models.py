import datetime

from django.db import models
from django.utils import timezone

# Se um pedido de análise fica pendente por mais tempo que isso sem o sensor
# responder (ex.: dispositivo desligado/fora de alcance), ele é tratado como
# abandonado e expira sozinho — bem maior que o check-in do RX (~1 min) e que
# o tempo que o frontend espera antes de desistir (~3 min), pra não expirar
# um pedido que ainda tem chance real de ser atendido.
TEMPO_LIMITE_PENDENCIA = datetime.timedelta(minutes=5)


class SolicitacaoRssi(models.Model):
    """
    Pedido de análise de RSSI/SNR pendente para um sensor específico — o
    sistema agora tem vários TX (ESP32_01, ESP32_02, ...), então cada um tem
    sua própria linha/flag. O ESP32 receptor consulta a cada check-in
    (GET /api/rssi/status/) se há algum pedido pendente e, se houver, para
    qual sensor_id; consulta esse rádio específico via LoRa e envia o
    resultado junto da próxima leitura desse sensor — que por sua vez limpa
    a flag automaticamente. Sem expiração, um sensor que nunca responde
    deixaria a flag pendente pra sempre, fazendo o RX consultar o rádio a
    cada ciclo indefinidamente — o oposto do "só quando o usuário pede".
    """

    sensor_id = models.CharField(max_length=100, unique=True)
    pendente = models.BooleanField(default=False)
    atualizado_em = models.DateTimeField(auto_now=True)

    @classmethod
    def obter(cls, sensor_id):
        """Uma linha por sensor — cria na primeira vez que esse sensor_id aparece."""
        solicitacao, _ = cls.objects.get_or_create(sensor_id=sensor_id)
        return solicitacao

    @classmethod
    def proxima_pendente(cls):
        """A solicitação pendente mais antiga (o RX so consulta uma por vez).
        Antes de procurar, limpa pedidos pendentes há mais que
        TEMPO_LIMITE_PENDENCIA — abandonados, não vão ser atendidos."""
        limite = timezone.now() - TEMPO_LIMITE_PENDENCIA
        cls.objects.filter(pendente=True, atualizado_em__lt=limite).update(pendente=False)
        return cls.objects.filter(pendente=True).order_by('atualizado_em').first()

    def __str__(self):
        return f'{self.sensor_id}: ' + ('pendente' if self.pendente else 'sem pedido pendente')


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
