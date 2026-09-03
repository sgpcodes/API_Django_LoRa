from rest_framework import serializers
from django.utils import timezone

from .models import Estacao, Leitura


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
    """Cadastro/edição/reatribuição de Estação. `dono` é gravável (troca de
    dono = RN15 "atribuir/trocar/remover em qualquer plano", ação do
    Gestor), mas quem decide QUEM pode de fato mudá-lo é a view
    (EstacaoViewSet.perform_update remove o campo do payload se quem edita
    não é Gestor) — o dono da própria estação continua podendo editar
    `nome`/`intervalo_envio_minutos`/etc., só não o `dono`.
    """

    esta_offline = serializers.BooleanField(read_only=True)
    dono_username = serializers.CharField(source='dono.username', read_only=True)
    dono_nome = serializers.SerializerMethodField()
    ultima_leitura = serializers.SerializerMethodField()

    class Meta:
        model = Estacao
        fields = [
            'id', 'identificador', 'nome', 'dono', 'dono_username', 'dono_nome',
            'intervalo_envio_minutos', 'limite_offline_minutos',
            'ultima_transmissao_em', 'ativa', 'criado_em', 'esta_offline', 'ultima_leitura',
        ]
        read_only_fields = ['id', 'ultima_transmissao_em', 'criado_em']
        extra_kwargs = {'dono': {'required': False}}

    def get_dono_nome(self, obj):
        return obj.dono.first_name or obj.dono.username

    def get_ultima_leitura(self, obj):
        leitura = Leitura.objects.filter(estacao=obj).order_by('-data_hora').first()
        return _leitura_resumo(leitura) if leitura else None

    def validate(self, attrs):
        """RN10: limite máximo de estações por nível de conta — vale tanto
        pra criação (dono default: quem está autenticado, se não vier no
        payload) quanto pra reatribuição (troca de dono numa estação já
        existente). Só dispara quando o dono-ALVO muda de fato: editar
        outros campos (nome, intervalo etc.) sem mexer no dono não conta
        estação nenhuma a mais pra ninguém.
        """
        if self.instance is None and 'dono' not in attrs:
            attrs['dono'] = self.context['request'].user

        dono_novo = attrs.get('dono')
        dono_mudou = dono_novo is not None and (self.instance is None or dono_novo != self.instance.dono)

        if dono_mudou:
            from contas.models import Assinatura

            assinatura = Assinatura.objects.filter(
                usuario=dono_novo, encerrada_em__isnull=True,
            ).select_related('plano').first()

            if assinatura is not None and assinatura.plano.max_estacoes is not None:
                estacoes_atuais = Estacao.objects.filter(dono=dono_novo)
                if self.instance is not None:
                    estacoes_atuais = estacoes_atuais.exclude(pk=self.instance.pk)
                if estacoes_atuais.count() >= assinatura.plano.max_estacoes:
                    raise serializers.ValidationError(
                        {'dono': f'Limite de {assinatura.plano.max_estacoes} estação(ões) do plano '
                                 f'"{assinatura.plano.nome}" atingido.'}
                    )

        return attrs
