"""
Importa o histórico recente da Open-Meteo (até 30 dias, uma leitura por
hora) pra dentro de uma Estacao tipo=online recém-criada — sem isso, ela
nasceria sem nenhum dado, e só começaria a acumular histórico dali pra
frente (a cada ciclo do coletar_dados_online). Chamado automaticamente
por EstacaoViewSet.perform_create (api_rest/views.py) na criação de uma
estação online, mas também pode ser rodado na mão pra repetir o
backfill de uma estação que já existe.

Idempotente: não duplica Leitura se já existir uma com o mesmo
data_hora pra essa Estacao (rodar duas vezes não cria o dobro).

Uso:
    python manage.py backfill_historico_estacao <id-da-estacao>
"""

from django.core.management.base import BaseCommand, CommandError

from api_rest.models import Estacao, Leitura
from api_rest.open_meteo import buscar_historico


class Command(BaseCommand):
    help = 'Importa até 30 dias de histórico da Open-Meteo para uma Estacao tipo=online.'

    def add_arguments(self, parser):
        parser.add_argument('estacao_id', help='Id da Estacao (precisa ser tipo=online, com latitude/longitude).')

    def handle(self, *args, **options):
        try:
            estacao = Estacao.objects.get(pk=options['estacao_id'])
        except Estacao.DoesNotExist:
            raise CommandError(f'Estação id={options["estacao_id"]} não encontrada.')

        if estacao.tipo != Estacao.Tipo.ONLINE:
            raise CommandError(f'Estação "{estacao.identificador}" não é tipo=online — nada a importar.')
        if estacao.latitude is None or estacao.longitude is None:
            raise CommandError(f'Estação "{estacao.identificador}" não tem latitude/longitude definidas.')

        pontos = buscar_historico(estacao.latitude, estacao.longitude)

        ja_existentes = set(
            Leitura.objects.filter(estacao=estacao, data_hora__in=[p['data_hora'] for p in pontos])
            .values_list('data_hora', flat=True)
        )

        novas = [
            Leitura(
                sensor_id=estacao.identificador,
                estacao=estacao,
                temperatura=ponto['temperatura'],
                umidade=ponto['umidade'],
                pressao=ponto['pressao'],
                dados_adicionais=ponto['dados_adicionais'],
                data_hora=ponto['data_hora'],
            )
            for ponto in pontos
            if ponto['data_hora'] not in ja_existentes
        ]

        Leitura.objects.bulk_create(novas)

        if novas:
            mais_recente = max(ponto.data_hora for ponto in novas)
            if estacao.ultima_transmissao_em is None or mais_recente > estacao.ultima_transmissao_em:
                estacao.ultima_transmissao_em = mais_recente
                estacao.save(update_fields=['ultima_transmissao_em'])

        self.stdout.write(self.style.SUCCESS(
            f'{len(novas)}/{len(pontos)} leitura(s) importada(s) para "{estacao.identificador}" '
            f'({len(pontos) - len(novas)} já existiam).',
        ))
