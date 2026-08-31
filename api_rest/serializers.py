from rest_framework import serializers
from django.utils import timezone

from .models import Estacao, Leitura


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
    """Cadastro/edição de Estação. `dono` é read-only aqui de propósito: só
    quem cria/edita é o Gestor (EstacaoViewSet.get_permissions), e é a
    própria view (perform_create) quem resolve o dono a partir do campo
    bruto `dono` do payload — assim dá para a view decidir, sem o
    serializer achar que está mudando o dono numa edição comum.
    """

    esta_offline = serializers.BooleanField(read_only=True)

    class Meta:
        model = Estacao
        fields = [
            'id', 'identificador', 'nome', 'dono',
            'intervalo_envio_minutos', 'limite_offline_minutos',
            'ultima_transmissao_em', 'ativa', 'criado_em', 'esta_offline',
        ]
        read_only_fields = ['id', 'dono', 'ultima_transmissao_em', 'criado_em']

    def validate(self, attrs):
        """RN10: limite máximo de estações por nível de conta. Só se aplica
        na criação (na edição o dono não muda) e só quando o dono-alvo já
        tem uma assinatura ativa com limite definido (max_estacoes=None =
        sem limite, ex.: plano Plus).

        O dono-alvo é resolvido da mesma forma que a view resolve
        (payload bruto `dono`, com fallback pra quem está autenticado) —
        importante quando é o Gestor cadastrando uma estação para OUTRO
        usuário: o limite tem que valer para o dono real, não para o
        Gestor que está fazendo a chamada.
        """
        if self.instance is not None:
            return attrs

        request = self.context['request']
        from contas.models import Assinatura, Usuario

        dono_id = self.initial_data.get('dono') or request.user.id
        dono = Usuario.objects.filter(pk=dono_id).first()
        if dono is None:
            raise serializers.ValidationError({'dono': 'Usuário não encontrado.'})

        assinatura = Assinatura.objects.filter(
            usuario=dono, encerrada_em__isnull=True,
        ).select_related('plano').first()

        if assinatura is not None and assinatura.plano.max_estacoes is not None:
            estacoes_atuais = Estacao.objects.filter(dono=dono).count()
            if estacoes_atuais >= assinatura.plano.max_estacoes:
                raise serializers.ValidationError(
                    f'Limite de {assinatura.plano.max_estacoes} estação(ões) do plano '
                    f'"{assinatura.plano.nome}" atingido. Faça upgrade para cadastrar mais.'
                )

        return attrs
