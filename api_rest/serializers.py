from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.utils import timezone

from .models import Estacao, Leitura

Usuario = get_user_model()


def _leitura_resumo(leitura):
    """Resumo compacto de uma leitura (temperatura/umidade/pressão + o que
    veio em `dados_adicionais`: RSSI/SNR/config do rádio, vento quando
    existir) — usado pela tela de Estações do admin, que mostra tudo
    "reduzido, no mesmo lugar", sem precisar de uma segunda tela pra
    RSSI/config (RN14-RN18)."""
    return {
        'temperatura': leitura.temperatura,
        'umidade': leitura.umidade,
        'pressao': leitura.pressao,
        'dados_adicionais': leitura.dados_adicionais,
        'data_hora': leitura.data_hora,
        'inconsistente': leitura.inconsistente,
    }


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


class EstacaoSerializer(serializers.ModelSerializer):
    """Cadastro/edição de Estação. `usuarios` é uma lista gravável (RN15:
    não existe "dono" único — o Gestor vincula quantas contas quiser à
    mesma estação, todas com o mesmo nível de acesso), mas quem decide se
    esse campo pode ser mudado é a view (EstacaoViewSet.perform_update
    remove o campo do payload se quem edita não é Gestor) — uma conta já
    vinculada continua podendo editar `nome`/`intervalo_envio_minutos`/
    etc. da própria estação, só não a lista de vínculos.
    """

    esta_offline = serializers.BooleanField(read_only=True)
    usuarios = serializers.PrimaryKeyRelatedField(many=True, queryset=Usuario.objects.all())
    usuarios_info = serializers.SerializerMethodField()
    ultima_leitura = serializers.SerializerMethodField()

    class Meta:
        model = Estacao
        fields = [
            'id', 'identificador', 'nome', 'localizacao', 'usuarios', 'usuarios_info',
            'intervalo_envio_minutos', 'limite_offline_minutos', 'tipo', 'latitude', 'longitude',
            'ultima_transmissao_em', 'ativa', 'criado_em', 'esta_offline', 'ultima_leitura',
        ]
        read_only_fields = ['id', 'ultima_transmissao_em', 'criado_em']

    def get_usuarios_info(self, obj):
        return [
            {'id': usuario.id, 'username': usuario.username, 'nome': usuario.first_name or usuario.username, 'plano': self._plano_de(usuario)}
            for usuario in obj.usuarios.all()
        ]

    def _plano_de(self, usuario):
        # `assinatura_ativa_prefetch` só existe quando veio da queryset
        # otimizada de EstacaoViewSet.get_queryset() (evita 1 query extra
        # por usuário — mesmo padrão de contas/serializers.py:UsuarioSerializer).
        if hasattr(usuario, 'assinatura_ativa_prefetch'):
            lista = usuario.assinatura_ativa_prefetch
            assinatura = lista[0] if lista else None
        else:
            assinatura = usuario.assinaturas.filter(encerrada_em__isnull=True).select_related('plano').first()
        return assinatura.plano.nome if assinatura else None

    def get_ultima_leitura(self, obj):
        leitura = Leitura.objects.filter(estacao=obj).order_by('-data_hora').first()
        return _leitura_resumo(leitura) if leitura else None

    def validate(self, attrs):
        """RN10: limite máximo de estações por nível de conta — checado só
        por conta NOVA sendo vinculada (adicionar uma 5ª conta a uma
        estação que 4 pessoas já compartilham não gasta cota de ninguém
        além de quem está entrando agora; editar outros campos sem mexer
        em `usuarios` não dispara nada disso)."""
        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', Estacao.Tipo.FISICA))
        if tipo == Estacao.Tipo.ONLINE:
            latitude = attrs.get('latitude', getattr(self.instance, 'latitude', None))
            longitude = attrs.get('longitude', getattr(self.instance, 'longitude', None))
            if latitude is None or longitude is None:
                raise serializers.ValidationError({'latitude': 'Estação online precisa de latitude e longitude.'})
        else:
            # Física não usa coordenada — zera em vez de deixar lixo de uma
            # eventual troca de tipo (online -> física) pra trás.
            attrs['latitude'] = None
            attrs['longitude'] = None

        usuarios_novos = attrs.get('usuarios')
        if usuarios_novos is None:
            return attrs

        if self.instance is None and len(usuarios_novos) == 0:
            raise serializers.ValidationError({'usuarios': 'Selecione ao menos uma conta.'})

        # RN10 (limite de estações por plano) desativado por pedido explícito
        # do Gestor: por enquanto o sistema é "pré-moldado" de forma manual —
        # o Gestor decide livremente quantas estações cada conta tem, sem
        # bloqueio automático por plano. Essa regra de negócio volta quando
        # o esquema de planos/assinatura for de fato implementado pra valer.

        return attrs
