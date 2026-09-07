"""
Lógica de manutenção compartilhada entre o management command
`limpar_dados_operacionais` e o endpoint protegido (Gestor-only) usado
pelo painel administrativo — as duas pontas de entrada fazem exatamente
a mesma coisa, só muda como são acionadas (terminal vs. navegador).

Apaga dados OPERACIONAIS (contas de usuário já cadastradas + leituras/
estações já recebidas) — mantém intacto tudo que é CONFIGURAÇÃO do
sistema (Plano, Funcionalidade, TokenCredenciamento) e a(s) conta(s)
superusuário, pra nunca trancar ninguém pra fora. Não apaga nenhuma
tabela nem migration — só as linhas.
"""

from django.db import transaction

from api_rest.models import Estacao, Leitura, SolicitacaoRssi

from .models import Assinatura, Usuario


def resumir_limpeza_operacional():
    """Prévia (dry-run) do que `executar_limpeza_operacional` apagaria,
    sem apagar nada — é o que a tela de manutenção mostra antes da
    pessoa confirmar."""
    contas_alvo = Usuario.objects.filter(is_superuser=False)
    return {
        'leituras': Leitura.objects.count(),
        'solicitacoes_rssi': SolicitacaoRssi.objects.count(),
        'estacoes': Estacao.objects.count(),
        'contas': contas_alvo.count(),
        'assinaturas': Assinatura.objects.filter(usuario__in=contas_alvo).count(),
        'superusuarios_preservados': list(Usuario.objects.filter(is_superuser=True).values_list('username', flat=True)),
    }


def executar_limpeza_operacional():
    """Apaga de verdade. Devolve os mesmos números que
    `resumir_limpeza_operacional` (calculados ANTES de apagar, já que
    depois os contadores dariam tudo zero)."""
    resumo = resumir_limpeza_operacional()
    contas_alvo = Usuario.objects.filter(is_superuser=False)

    with transaction.atomic():
        # Ordem importa: Estacao.dono é PROTECT (RN15), então as
        # estações têm que sumir ANTES das contas, senão a exclusão da
        # conta falha com ProtectedError. Leitura/SolicitacaoRssi não
        # travam nada (SET_NULL), mas apagar antes evita ficarem
        # penduradas sem estação por meio segundo.
        Leitura.objects.all().delete()
        SolicitacaoRssi.objects.all().delete()
        Estacao.objects.all().delete()
        contas_alvo.delete()  # Assinatura cai junto via CASCADE

    return resumo
