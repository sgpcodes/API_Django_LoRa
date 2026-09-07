"""
Apaga dados OPERACIONAIS (contas de usuário já cadastradas + leituras/
estações já recebidas) pra "zerar" o sistema antes de começar a receber
contas e dados de verdade — mantém intacto tudo que é CONFIGURAÇÃO do
sistema (Plano, Funcionalidade, TokenCredenciamento) e a(s) conta(s)
superusuário (acesso de admin do Django), pra nunca trancar ninguém
pra fora. Não apaga nenhuma tabela nem migration — só as linhas.

Mesma lógica usada pela tela de manutenção do painel admin (ver
contas/manutencao.py) — este comando é a via alternativa pra quem tem
acesso ao Shell do servidor.

Por padrão roda em modo "dry-run" (só mostra o que seria apagado, sem
apagar nada de verdade) — precisa da flag --confirmar pra executar.

Uso:
    python manage.py limpar_dados_operacionais             # dry-run
    python manage.py limpar_dados_operacionais --confirmar  # apaga de verdade
"""

from django.core.management.base import BaseCommand

from contas.manutencao import executar_limpeza_operacional, resumir_limpeza_operacional


class Command(BaseCommand):
    help = 'Apaga contas (exceto superusuário) e dados de clima já recebidos — mantém planos/token intactos.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirmar', action='store_true',
            help='Executa de verdade. Sem essa flag, só mostra o que seria apagado (dry-run).',
        )

    def handle(self, *args, **options):
        resumo = resumir_limpeza_operacional()

        self.stdout.write('Isto vai apagar:')
        self.stdout.write(f"  - {resumo['leituras']} leitura(s)")
        self.stdout.write(f"  - {resumo['solicitacoes_rssi']} solicitação(ões) de RSSI")
        self.stdout.write(f"  - {resumo['estacoes']} estação(ões)")
        self.stdout.write(f"  - {resumo['contas']} conta(s) (todas, exceto superusuário) e {resumo['assinaturas']} assinatura(s) junto (cascade)")
        self.stdout.write('')
        self.stdout.write(
            f"Preservados: {len(resumo['superusuarios_preservados'])} conta(s) superusuário "
            f"{resumo['superusuarios_preservados']}, Planos, Funcionalidades, Token de credenciamento, Log de auditoria.",
        )

        if not options['confirmar']:
            self.stdout.write(self.style.WARNING(
                '\nDRY-RUN — nada foi apagado. Rode de novo com --confirmar pra executar de verdade.',
            ))
            return

        executar_limpeza_operacional()

        self.stdout.write(self.style.SUCCESS(
            f"\nPronto: {resumo['leituras']} leitura(s), {resumo['solicitacoes_rssi']} solicitação(ões), "
            f"{resumo['estacoes']} estação(ões) e {resumo['contas']} conta(s) apagadas.",
        ))
