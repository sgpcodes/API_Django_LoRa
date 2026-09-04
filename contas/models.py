"""
Entidades de conta do sistema: Usuário/Gestor (login), Plano (nível de
conta), Funcionalidade (catálogo de recursos liberáveis por plano) e
LogAuditoria (rastro das ações críticas do Gestor).

Gestor e Usuário são o MESMO model (`Usuario`) diferenciado por um campo
`role`. Os dois fazem login com usuário/senha (RN20) e têm o mesmo formato
de dado cadastral — a diferença entre eles é só de PERMISSÃO (RN01-RN19),
não de mecanismo de autenticação. Por isso não existe uma tabela "Gestor"
separada: um Gestor é só um Usuario com role=GESTOR.

Referências entre parênteses (RNxx) apontam para as regras do documento
"Regras de Negócio: Sistema de Monitoramento Agroclimático via Estações
Meteorológicas IoT".
"""

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser, UserManager
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class TokenCredenciamento(models.Model):
    """Segredo compartilhado (hoje "Lacop22") que, digitado corretamente no
    cadastro público, credencia a conta como Gestor — é a "credencial da
    organização" da tela de cadastro/login.

    Cada linha é uma VERSÃO do token, nunca editada depois de criada —
    trocar o token (RN de negócio combinada com a usuária) é sempre um
    `rotacionar()`, que cria uma versão nova; a versão anterior fica só de
    histórico/auditoria (nunca é apagada, nunca volta a valer). Só a
    versão mais recente (`versao_atual()`) é aceita em `verificar()`.

    `Usuario.credenciamento_versao` guarda com qual versão aquela conta foi
    credenciada; se não bater mais com `versao_atual()`, a conta perde o
    efeito de Gestor até credenciar de novo com o token novo (ver
    `Usuario.eh_gestor`/`Usuario.precisa_recredenciar` abaixo).
    """

    versao = models.PositiveIntegerField(unique=True)
    token_hash = models.CharField(max_length=128)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Token de credenciamento'
        verbose_name_plural = 'Tokens de credenciamento'
        ordering = ['-versao']

    @classmethod
    def versao_atual(cls):
        atual = cls.objects.order_by('-versao').first()
        return atual.versao if atual else None

    @classmethod
    def verificar(cls, token_bruto):
        """Confere um token em texto puro contra a versão MAIS RECENTE
        (versões antigas nunca voltam a valer, mesmo que alguém ainda
        tenha o valor antigo salvo). Retorna a versão se bateu, ou None."""
        atual = cls.objects.order_by('-versao').first()
        if atual and token_bruto and check_password(token_bruto, atual.token_hash):
            return atual.versao
        return None

    @classmethod
    def rotacionar(cls, novo_token_bruto):
        """Cria a próxima versão do token — usado pelo admin ao trocar o
        segredo. Todas as contas credenciadas com versões anteriores
        passam a precisar recredenciar (Usuario.precisa_recredenciar)."""
        proxima_versao = (cls.versao_atual() or 0) + 1
        return cls.objects.create(versao=proxima_versao, token_hash=make_password(novo_token_bruto))

    def __str__(self):
        return f'Token v{self.versao} (criado em {self.criado_em:%d/%m/%Y})'


class UsuarioManager(UserManager):
    """Igual ao UserManager padrão do Django, só forçando que todo
    superusuário criado por `createsuperuser` já nasça com role=GESTOR —
    faz sentido, já que superusuário é quem administra o sistema todo."""

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('role', Usuario.Role.GESTOR)
        return super().create_superuser(username, email, password, **extra_fields)


class Usuario(AbstractUser):
    """Conta de login do sistema — tanto o Gestor quanto o Usuário final
    (produtor rural, agrônomo, cooperativa) usam este mesmo model.

    Estende AbstractUser (herda username, password, email, first/last_name,
    is_active, is_staff, is_superuser, date_joined) e soma:
    - `role`: define se é Gestor (acesso irrestrito, RN01-RN05) ou Usuário
      comum (acesso restrito às suas estações, RN06-RN13).
    - `telefone`: canal de recebimento de alerta por "mensagem telefônica"
      (RN13).
    - `cpf`: coletado e conferido (dígito verificador real, ver
      `contas.validacao.validar_cpf`) no cadastro público — obrigatório
      nesse fluxo. Único por (`cpf`, `role`) — não é único sozinho: a
      mesma pessoa pode ter uma conta Usuário (plano) e uma conta Gestor
      (credenciada) com o mesmo CPF, uma de cada tipo, mas não duas do
      mesmo tipo (ver `Meta.constraints`). Fica `null=True` (não `blank`
      sozinho) para permitir várias contas sem CPF fora desse fluxo
      (ex.: criadas via admin) sem violar a unicidade — duas strings
      vazias colidiriam, mas `NULL` não colide com `NULL` no banco.
    - `email`: mesma lógica do CPF — único por (`email`, `role`), não
      sozinho. A mesma pessoa pode logar numa conta Gestor e numa conta
      Usuário com o mesmo e-mail, uma de cada tipo (ver
      `Meta.constraints`). Continua sendo o valor que a pessoa digita pra
      logar (RN20) — a resolução de qual conta é qual, quando há duas
      com o mesmo e-mail, é feita testando a senha contra cada uma (ver
      `TokenObtainPairComRoleSerializer.validate`), não pelo campo
      `username` puro.
    - `email_verificado`: RN de confirmação de e-mail — vira `True`
      quando a pessoa clica no link enviado por `contas.emails`. Não
      bloqueia login (a conta funciona normalmente antes de confirmar);
      é só um sinalizador, já que o e-mail vai ser usado pra notificação
      e recuperação de senha mais pra frente.
    - `credenciamento_versao`: com qual versão do TokenCredenciamento essa
      conta foi credenciada como Gestor pelo cadastro público — `None`
      quando o Gestor NÃO veio desse caminho (ex.: `createsuperuser`, ou
      promovido diretamente por outro Gestor no admin/API). Só contas com
      uma versão preenchida ficam sujeitas a perder o acesso quando o
      token é rotacionado — promoção "de confiança" (admin) não é afetada
      por isso.

    `is_staff`/`is_superuser` continuam existindo (são do Django) e
    controlam só o acesso ao /admin/ — são ortogonais ao `role`, que é
    quem de fato dirige as regras de negócio da API.
    """

    class Role(models.TextChoices):
        GESTOR = 'gestor', 'Gestor'
        USUARIO = 'usuario', 'Usuário'

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USUARIO)
    telefone = models.CharField(max_length=20, blank=True)
    # Endereço, dividido em partes (não um campo único) — preenchido por
    # autoedição (Perfil) ou pelo Gestor (painel administrativo), igual ao
    # telefone: opcional, não faz parte do cadastro público.
    cep = models.CharField(max_length=9, blank=True, help_text='Formato: 00000-000.')
    rua = models.CharField(max_length=200, blank=True)
    numero = models.CharField(max_length=20, blank=True)
    cidade = models.CharField(max_length=100, blank=True)
    estado = models.CharField(max_length=2, blank=True, help_text='Sigla UF, ex.: RJ.')
    cpf = models.CharField(max_length=11, blank=True, null=True, help_text='Só dígitos, sem pontuação.')
    email_verificado = models.BooleanField(default=False)
    credenciamento_versao = models.PositiveIntegerField(null=True, blank=True)

    objects = UsuarioManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['cpf', 'role'], name='cpf_unico_por_papel'),
            # `condition`: só vale pra e-mail preenchido — diferente do cpf
            # (que usa null=True pra isso), o `email` herdado do
            # AbstractUser default pra string vazia (''), não NULL, então
            # sem essa condição contas sem e-mail (ex.: criadas via admin)
            # colidiriam todas entre si.
            models.UniqueConstraint(
                fields=['email', 'role'],
                condition=~models.Q(email=''),
                name='email_unico_por_papel',
            ),
        ]

    @property
    def eh_gestor(self):
        """Atalho usado nas permissions (api_rest/permissions.py) e nas
        views para checar RN01: Gestor tem acesso irrestrito a tudo.

        `role=GESTOR` sozinho não basta quando a conta foi credenciada
        pelo cadastro público: se o token já rotacionou desde então
        (`credenciamento_versao` não bate mais com a versão atual), o
        acesso de Gestor fica suspenso até recredenciar — mas só para
        quem entrou por esse caminho (`credenciamento_versao is None` =
        promovido por outro meio, não é afetado)."""
        if self.role != self.Role.GESTOR:
            return False
        if self.credenciamento_versao is None:
            return True
        return self.credenciamento_versao == TokenCredenciamento.versao_atual()

    @property
    def precisa_recredenciar(self):
        """True só para quem tem role=Gestor "de papel" mas perdeu o
        efeito por causa de rotação do token — é o gatilho pro frontend
        pedir o token novo (em vez de simplesmente negar acesso calado)."""
        return self.role == self.Role.GESTOR and self.credenciamento_versao is not None and not self.eh_gestor

    def __str__(self):
        return f'{self.get_username()} ({self.get_role_display()})'


class Funcionalidade(models.Model):
    """Catálogo de recursos que podem ser liberados por plano (ex.:
    'previsao_chuva_24_48h', 'modelos_machine_learning').

    Existir como tabela separada — em vez de uma lista fixa no código — é
    o que permite ao Gestor reclassificar o que cada plano libera sem
    precisar de deploy (RN24: "configurável pelo Gestor... sem necessidade
    de alteração de código").
    """

    codigo = models.SlugField(
        max_length=60, unique=True,
        help_text='Identificador estável usado no código (ex.: previsao_chuva_24_48h).',
    )
    nome = models.CharField(max_length=120)
    descricao = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Funcionalidade'
        verbose_name_plural = 'Funcionalidades'
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Plano(models.Model):
    """Nível de conta (Standard, Pro, Plus — RN21-RN23). Cada plano define
    limites (máx. de estações, dias de histórico) e quais Funcionalidades
    ele libera.

    A proposta do documento é cumulativa (Plus inclui tudo do Pro, que
    inclui tudo do Standard) — isso não é imposto pelo model, é uma
    convenção de cadastro: ao criar o plano Pro, o Gestor marca nele todas
    as Funcionalidades do Standard + as novas do Pro, e assim por diante.
    """

    nome = models.CharField(max_length=60, unique=True)
    ordem = models.PositiveSmallIntegerField(
        default=0, help_text='Usado só para ordenar a exibição (0=Standard, 1=Pro, 2=Plus...).',
    )
    max_estacoes = models.PositiveIntegerField(
        null=True, blank=True, help_text='Limite de estações vinculadas (RN10). Vazio = ilimitado (ex.: Plus).',
    )
    dias_historico = models.PositiveIntegerField(
        help_text='Quantos dias de histórico o Usuário enxerga no dashboard (RN29). '
                   'A retenção física no banco pode ser maior — isso aqui é só o que é exibido.',
    )
    canais_alerta = models.JSONField(
        default=list, blank=True,
        help_text='Canais de notificação liberados neste plano (RN13), ex.: ["email", "dashboard", "telefone"].',
    )
    funcionalidades = models.ManyToManyField(
        Funcionalidade, blank=True, related_name='planos',
        help_text='Recursos/modelos analíticos liberados por este plano (RN09, RN24).',
    )
    preco_mensal = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Plano'
        verbose_name_plural = 'Planos'
        ordering = ['ordem']

    def __str__(self):
        return self.nome


class Assinatura(models.Model):
    """Vínculo entre um Usuário e um Plano, com histórico (RN25): cada vez
    que o plano muda, a assinatura antiga é encerrada (`encerrada_em`
    preenchido) e uma nova linha é criada — nunca sobrescrevemos o plano
    "atual" numa única linha, porque o histórico de qual plano valia em
    cada período é o que permite responder "esse usuário tinha acesso a
    este modelo na data X?" mais pra frente.

    A constraint `uma_assinatura_ativa_por_usuario` garante no nível do
    banco que um Usuário nunca tenha duas assinaturas "em aberto" ao mesmo
    tempo (o que corromperia a regra de "qual é o plano atual dele").
    """

    class Status(models.TextChoices):
        ATIVA = 'ativa', 'Ativa'
        INADIMPLENTE = 'inadimplente', 'Inadimplente'  # RN06: assinatura com pendência financeira
        CANCELADA = 'cancelada', 'Cancelada'
        EXPIRADA = 'expirada', 'Expirada'

    class Origem(models.TextChoices):
        AUTOATENDIMENTO = 'autoatendimento', 'Autoatendimento'
        GESTOR = 'gestor', 'Alteração manual do Gestor'  # RN03

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assinaturas',
    )
    plano = models.ForeignKey(Plano, on_delete=models.PROTECT, related_name='assinaturas')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ATIVA)
    origem = models.CharField(max_length=20, choices=Origem.choices, default=Origem.AUTOATENDIMENTO)
    iniciada_em = models.DateTimeField(auto_now_add=True)
    encerrada_em = models.DateTimeField(
        null=True, blank=True, help_text='Preenchido quando o usuário troca de plano ou cancela.',
    )

    class Meta:
        verbose_name = 'Assinatura'
        verbose_name_plural = 'Assinaturas'
        ordering = ['-iniciada_em']
        constraints = [
            models.UniqueConstraint(
                fields=['usuario'],
                condition=models.Q(encerrada_em__isnull=True),
                name='uma_assinatura_ativa_por_usuario',
            ),
        ]

    def __str__(self):
        return f'{self.usuario} — {self.plano} ({self.status})'


class LogAuditoria(models.Model):
    """Rastro de toda ação crítica do Gestor sobre Usuários, Estações ou
    Planos (RN05: "autor, data/hora e ação executada").

    Usa GenericForeignKey (via `alvo_tipo`/`alvo_id`) para poder apontar
    tanto para um Usuario quanto para uma Estacao (que vive no app
    api_rest) sem que este app `contas` precise importar `api_rest` —
    evita import cruzado entre apps.
    """

    ator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+',
        help_text='Quem executou a ação. SET_NULL (não CASCADE): o log sobrevive mesmo se a conta do ator for removida.',
    )
    acao = models.CharField(max_length=100, help_text='Ex.: "estacao.criada", "usuario.suspenso", "plano.alterado".')
    alvo_tipo = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    alvo_id = models.PositiveIntegerField(null=True, blank=True)
    alvo = GenericForeignKey('alvo_tipo', 'alvo_id')
    detalhes = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Log de auditoria'
        verbose_name_plural = 'Logs de auditoria'
        ordering = ['-criado_em']

    def __str__(self):
        return f'[{self.criado_em:%Y-%m-%d %H:%M}] {self.ator}: {self.acao}'
