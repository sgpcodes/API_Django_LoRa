from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Assinatura, Funcionalidade, Plano, TokenCredenciamento, Usuario
from .tokens import gerador_token_verificacao_email
from .validacao import limpar_cpf, validar_cpf


class TokenObtainPairComRoleSerializer(TokenObtainPairSerializer):
    """Igual ao par de token padrão do simplejwt, só que embute `role`,
    `username` e `precisa_recredenciar` no próprio token JWT (claims) —
    assim o frontend sabe se é Gestor/Usuário, e se precisa pedir o token
    de credenciamento de novo, sem precisar de uma segunda chamada à API
    logo após o login.

    RN: a pessoa só completa o cadastro (consegue entrar de verdade) com
    o e-mail confirmado — usuário/senha corretos não bastam se
    `email_verificado` ainda for `False`. Superusuário (`createsuperuser`,
    acesso de shell no servidor) é a única exceção: é criado por um meio
    já confiável, não pelo cadastro público, não faz sentido travar por
    e-mail.
    """

    default_error_messages = {
        **TokenObtainPairSerializer.default_error_messages,
        'email_nao_confirmado': 'Confirme seu e-mail antes de entrar. Reenviamos o link se precisar.',
    }

    def validate(self, attrs):
        dados = super().validate(attrs)
        if not self.user.email_verificado and not self.user.is_superuser:
            raise serializers.ValidationError(
                {'detail': self.error_messages['email_nao_confirmado'], 'codigo': 'email_nao_confirmado'},
            )
        return dados

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['username'] = user.username
        token['precisa_recredenciar'] = user.precisa_recredenciar
        return token


class UsuarioSerializer(serializers.ModelSerializer):
    """Cadastro/edição de conta (RN08: usuário gerencia seus próprios
    dados cadastrais). `password` é write-only e só é aplicado via
    `set_password` (nunca gravamos senha em texto puro); `role` só pode
    ser alterado pelo Gestor — a view remove esse campo do payload antes
    de chamar o serializer quando quem está editando não é Gestor."""

    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'cpf',
            'telefone', 'role', 'is_active', 'email_verificado', 'date_joined', 'password',
        ]
        # cpf/email_verificado só leitura aqui: são conferidos (CPF real,
        # e-mail clicado no link) só nos fluxos próprios — cadastro
        # público e confirmação de e-mail — não por uma edição qualquer.
        read_only_fields = ['id', 'date_joined', 'cpf', 'email_verificado']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        usuario = Usuario(**validated_data)
        if password:
            usuario.set_password(password)
        usuario.save()
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for campo, valor in validated_data.items():
            setattr(instance, campo, valor)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class FuncionalidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Funcionalidade
        fields = ['id', 'codigo', 'nome', 'descricao']


class PlanoSerializer(serializers.ModelSerializer):
    """`funcionalidades` continua sendo a lista de PKs (é o que o Gestor
    edita via PATCH, RN24). `funcionalidades_detalhe` é só leitura, com
    nome de cada uma — pensado pra tela pública de cadastro/planos
    mostrar os recursos por extenso sem precisar de uma segunda chamada."""

    funcionalidades_detalhe = FuncionalidadeSerializer(source='funcionalidades', many=True, read_only=True)

    class Meta:
        model = Plano
        fields = [
            'id', 'nome', 'ordem', 'max_estacoes', 'dias_historico', 'canais_alerta',
            'funcionalidades', 'funcionalidades_detalhe', 'preco_mensal', 'ativo',
        ]


class AssinaturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assinatura
        fields = ['id', 'usuario', 'plano', 'status', 'origem', 'iniciada_em', 'encerrada_em']
        read_only_fields = ['id', 'status', 'origem', 'iniciada_em', 'encerrada_em']


class CadastroSerializer(serializers.Serializer):
    """Cadastro público (tela "Criar conta"): dois caminhos mutuamente
    exclusivos —
    1. informa `plano` -> vira Usuário comum, com Assinatura nesse plano;
    2. informa `token_credenciamento` correto -> vira Gestor (RN01),
       sem Assinatura (Gestor não precisa de plano).

    O e-mail também é o `username` de login — o cadastro não pede um nome
    de usuário separado (segue a tela: só e-mail), então login por
    "usuário ou e-mail" funciona de graça, já que os dois valores são
    iguais para quem se cadastrou por aqui.
    """

    email = serializers.EmailField()
    nome_completo = serializers.CharField(max_length=150)
    cpf = serializers.CharField(max_length=14)
    password = serializers.CharField(write_only=True, min_length=8)
    confirmar_senha = serializers.CharField(write_only=True, min_length=8)
    plano = serializers.PrimaryKeyRelatedField(queryset=Plano.objects.filter(ativo=True), required=False)
    token_credenciamento = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_email(self, email):
        if Usuario.objects.filter(username__iexact=email).exists():
            raise serializers.ValidationError('Já existe uma conta com este e-mail.')
        return email

    def validate_cpf(self, cpf):
        """Só confere o dígito verificador aqui — a checagem de
        duplicidade entra em `validate()`, porque depende de saber se é
        cadastro de Usuário ou de Gestor (o mesmo CPF pode ter uma conta
        de cada tipo, só não duas do mesmo tipo)."""
        if not validar_cpf(cpf):
            raise serializers.ValidationError('CPF inválido.')
        return limpar_cpf(cpf)

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('confirmar_senha'):
            raise serializers.ValidationError({'confirmar_senha': 'As senhas não coincidem.'})

        token_bruto = attrs.get('token_credenciamento')
        if token_bruto:
            versao = TokenCredenciamento.verificar(token_bruto)
            if versao is None:
                raise serializers.ValidationError({'token_credenciamento': 'Token de credenciamento inválido.'})
            attrs['_credenciamento_versao'] = versao
            papel_pretendido = Usuario.Role.GESTOR
        elif not attrs.get('plano'):
            raise serializers.ValidationError({'plano': 'Escolha um plano, ou informe um token de credenciamento.'})
        else:
            papel_pretendido = Usuario.Role.USUARIO

        # A mesma pessoa pode ter uma conta Usuário e uma conta Gestor com
        # o mesmo CPF (RN: "PF/PJ no mesmo banco") — só não duas do mesmo
        # papel. Por isso essa checagem é aqui, e não em `validate_cpf`,
        # que não sabe ainda qual papel está sendo cadastrado.
        if Usuario.objects.filter(cpf=attrs['cpf'], role=papel_pretendido).exists():
            rotulo = 'Gestor' if papel_pretendido == Usuario.Role.GESTOR else 'Usuário'
            raise serializers.ValidationError(
                {'cpf': f'Já existe uma conta {rotulo} com este CPF.'}
            )

        return attrs

    def create(self, validated_data):
        credenciamento_versao = validated_data.pop('_credenciamento_versao', None)
        validated_data.pop('token_credenciamento', None)
        plano = validated_data.pop('plano', None)

        usuario = Usuario(
            username=validated_data['email'],
            email=validated_data['email'],
            first_name=validated_data['nome_completo'],
            cpf=validated_data['cpf'],
        )
        if credenciamento_versao is not None:
            usuario.role = Usuario.Role.GESTOR
            usuario.credenciamento_versao = credenciamento_versao
        usuario.set_password(validated_data['password'])
        usuario.save()

        if plano is not None:
            Assinatura.objects.create(usuario=usuario, plano=plano, origem=Assinatura.Origem.AUTOATENDIMENTO)

        return usuario


class RecredenciarSerializer(serializers.Serializer):
    """Usada tanto por quem está com `precisa_recredenciar=True` (token
    rotacionou) quanto por qualquer Usuário comum que queira virar Gestor
    depois, digitando o token — mesmo caminho, mesma regra."""

    token = serializers.CharField(write_only=True)

    def validate_token(self, token_bruto):
        versao = TokenCredenciamento.verificar(token_bruto)
        if versao is None:
            raise serializers.ValidationError('Token de credenciamento inválido.')
        return versao

    def save(self):
        usuario = self.context['request'].user
        usuario.role = Usuario.Role.GESTOR
        usuario.credenciamento_versao = self.validated_data['token']  # já é a versão, ver validate_token
        usuario.save(update_fields=['role', 'credenciamento_versao'])
        return usuario


class ConfirmarEmailSerializer(serializers.Serializer):
    """`uidb64`/`token` vêm do link enviado por e-mail (ver
    contas/emails.py) — sem exigir login, porque é exatamente o e-mail
    que ainda não foi confirmado que autentica essa ação."""

    uidb64 = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        try:
            pk = force_str(urlsafe_base64_decode(attrs['uidb64']))
            usuario = Usuario.objects.get(pk=pk)
        except (ValueError, TypeError, OverflowError, Usuario.DoesNotExist):
            raise serializers.ValidationError('Link de confirmação inválido.')

        if not gerador_token_verificacao_email.check_token(usuario, attrs['token']):
            raise serializers.ValidationError('Link de confirmação inválido ou expirado.')

        attrs['usuario'] = usuario
        return attrs

    def save(self):
        usuario = self.validated_data['usuario']
        if not usuario.email_verificado:
            usuario.email_verificado = True
            usuario.save(update_fields=['email_verificado'])
        return usuario


class ReenviarConfirmacaoPublicoSerializer(serializers.Serializer):
    """Só valida o formato do e-mail — a view decide o que fazer com ele
    (existe ou não, já confirmado ou não) sem expor isso na resposta, pra
    não virar um jeito de descobrir quais e-mails têm conta cadastrada."""

    email = serializers.EmailField()
