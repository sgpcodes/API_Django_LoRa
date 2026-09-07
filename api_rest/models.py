import datetime
import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

# Se um pedido de análise fica pendente por mais tempo que isso sem o sensor
# responder (ex.: dispositivo desligado/fora de alcance), ele é tratado como
# abandonado e expira sozinho — bem maior que o check-in do RX (~1 min) e que
# o tempo que o frontend espera antes de desistir (~3 min), pra não expirar
# um pedido que ainda tem chance real de ser atendido.
TEMPO_LIMITE_PENDENCIA = datetime.timedelta(minutes=5)


class Estacao(models.Model):
    """A estação meteorológica física (ESP32 + sensores) — entidade "Estação"
    do documento de regras de negócio (RN14-RN18).

    IMPORTANTE sobre o firmware atual: o ESP32 (RX) já envia leituras hoje
    identificando o sensor só por uma string solta (campo "sensor" no JSON,
    ex.: "ESP32_01") e SEM nenhum token de autenticação. Esta entidade já
    modela a Estação como ela deveria ser (dona, token, intervalo esperado
    de envio) para permitir migrar a autenticação da estação e ligar o
    controle de acesso do Usuário mais pra frente, MAS por enquanto:
    - o campo `token_hash` fica vazio até uma estação ser emitida via
      `gerar_token()` (ninguém é obrigado a ter token ainda);
    - o endpoint de ingestão (LeituraListCreateView.post) continua aberto
      (AllowAny) e apenas *tenta* casar o `sensor_id` recebido com uma
      Estacao já cadastrada por `identificador` — se não achar, a leitura
      é salva do mesmo jeito, com `estacao=None`, exatamente como hoje.
    Isso evita qualquer mudança de firmware nesta fase.
    """

    class IntervaloEnvio(models.IntegerChoices):
        CINCO_MIN = 5, '5 minutos'
        DEZ_MIN = 10, '10 minutos'
        QUINZE_MIN = 15, '15 minutos'

    identificador = models.CharField(
        max_length=100, unique=True,
        help_text='Mesmo valor que o firmware envia como "sensor" (ex.: ESP32_01). '
                  'É o que liga uma Leitura recebida a esta Estação.',
    )
    nome = models.CharField(max_length=150, blank=True, help_text='Nome amigável, exibido no dashboard.')
    localizacao = models.CharField(
        max_length=200, blank=True,
        help_text='Local em texto livre (ex.: "Área de Plantio - Talhão 2"), preenchido pelo Gestor — não vem do dispositivo.',
    )
    dono = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='estacoes',
        help_text='Usuário (ou Gestor) responsável pela estação (RN15: toda estação tem exatamente um dono, '
                  'nunca fica "órfã"). PROTECT: não deixa apagar um usuário que ainda tem estação vinculada.',
    )
    token_hash = models.CharField(
        max_length=128, blank=True,
        help_text='Hash do token de autenticação do dispositivo (RN14). Vazio = token ainda não emitido.',
    )
    intervalo_envio_minutos = models.PositiveSmallIntegerField(
        choices=IntervaloEnvio.choices, default=IntervaloEnvio.DEZ_MIN,
        help_text='Intervalo esperado entre transmissões (RN16), usado para calcular se está offline.',
    )
    limite_offline_minutos = models.PositiveSmallIntegerField(
        default=30, help_text='Minutos sem transmitir até considerar a estação "offline" (RN17).',
    )
    ultima_transmissao_em = models.DateTimeField(
        null=True, blank=True, help_text='Atualizado a cada leitura recebida com sucesso (RN16).',
    )
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Estação'
        verbose_name_plural = 'Estações'
        ordering = ['identificador']

    def gerar_token(self):
        """Gera um novo token de API para o dispositivo, salva só o HASH no
        banco (mesmo mecanismo usado para senha de usuário, via
        make_password/check_password) e devolve o token em TEXTO PURO —
        que só existe neste retorno; não fica recuperável depois. Quem
        chamar isso precisa mostrar/entregar o valor devolvido na hora."""
        token_plano = secrets.token_hex(32)
        self.token_hash = make_password(token_plano)
        self.save(update_fields=['token_hash'])
        return token_plano

    def verificar_token(self, token_plano):
        """Confere um token em texto puro (ex.: vindo de um header
        Authorization) contra o hash salvo. Usado pela autenticação da
        Estação quando essa fase for ligada (fora do escopo atual)."""
        return bool(self.token_hash) and check_password(token_plano, self.token_hash)

    @property
    def esta_offline(self):
        """RN17: sem transmissão dentro do limite configurado = offline.
        Calculado sob demanda (não persistido) — marcar e desmarcar
        "offline" de verdade exige um job periódico que ainda não existe
        (faz parte do motor de alertas, que é a próxima fase)."""
        if self.ultima_transmissao_em is None:
            return True
        limite = timezone.now() - datetime.timedelta(minutes=self.limite_offline_minutos)
        return self.ultima_transmissao_em < limite

    def __str__(self):
        return self.nome or self.identificador


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
    estacao = models.ForeignKey(
        Estacao, null=True, blank=True, on_delete=models.SET_NULL, related_name='solicitacoes_rssi',
        help_text='Preenchido por resolução automática a partir de sensor_id, quando a Estacao já existir.',
    )
    pendente = models.BooleanField(default=False)
    atualizado_em = models.DateTimeField(auto_now=True)

    @classmethod
    def obter(cls, sensor_id):
        """Uma linha por sensor — cria na primeira vez que esse sensor_id aparece."""
        solicitacao, criada = cls.objects.get_or_create(sensor_id=sensor_id)
        if criada or solicitacao.estacao_id is None:
            estacao = Estacao.objects.filter(identificador=sensor_id).first()
            if estacao is not None:
                solicitacao.estacao = estacao
                solicitacao.save(update_fields=['estacao'])
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

    sensor_id = models.CharField(
        max_length=100,
        help_text='Identificador cru enviado pelo dispositivo (campo "sensor" do payload). '
                  'Mantido tal como está por compatibilidade com o firmware atual.',
    )
    estacao = models.ForeignKey(
        Estacao, null=True, blank=True, on_delete=models.SET_NULL, related_name='leituras',
        help_text='Resolvida automaticamente a partir de sensor_id no momento do POST, quando a '
                  'Estacao correspondente já estiver cadastrada. Nula = estação ainda não cadastrada '
                  '(a leitura é salva mesmo assim, sem dono, como sempre foi).',
    )
    temperatura = models.FloatField()
    umidade = models.FloatField()
    pressao = models.FloatField(null=True, blank=True)
    dados_adicionais = models.JSONField(default=dict, blank=True)
    data_hora = models.DateTimeField()
    inconsistente = models.BooleanField(
        default=False,
        help_text='RN18: valor fora de faixa fisicamente plausível (ex.: umidade > 100%). '
                  'A leitura é armazenada mesmo assim (para auditoria), só fica marcada para ser '
                  'excluída dos modelos preditivos.',
    )
    motivo_inconsistencia = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-data_hora']
        indexes = [models.Index(fields=['estacao', '-data_hora'])]

    def __str__(self):
        return f'{self.sensor_id} — {self.temperatura}°C / {self.umidade}% ({self.data_hora})'
