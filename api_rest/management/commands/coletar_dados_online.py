"""
Roda em loop de fundo (ver docker/backend/entrypoint.sh), a cada
ONLINE_COLLECT_INTERVAL_SECONDS (padrão 600 = 10 min, mesma cadência de
transmissão do hardware real) — busca a leitura mais recente da
Open-Meteo pra cada Estacao tipo=online e grava como uma Leitura nova,
exatamente como se tivesse chegado de um ESP32 de verdade. É assim que
o histórico dessas estações cresce dia a dia, em vez de depender da
Open-Meteo estar disponível toda vez que alguém abrir o Dashboard.

Diferente de sincronizar_leituras.py (que só roda se CLOUD_DATABASE_URL
estiver configurada), este comando não tem variável de ambiente de
controle — sem nenhuma Estacao tipo=online cadastrada, ele só não faz
nada (barato de chamar em loop o tempo todo).

Uso:
    python manage.py coletar_dados_online
"""

from django.core.management.base import BaseCommand
from django.db import DatabaseError
from requests import RequestException

from api_rest.models import Estacao, Leitura
from api_rest.open_meteo import buscar_leitura_atual


class Command(BaseCommand):
    help = 'Busca a leitura mais recente da Open-Meteo para cada Estacao tipo=online e grava como Leitura.'

    def handle(self, *args, **options):
        estacoes = Estacao.objects.filter(tipo=Estacao.Tipo.ONLINE, ativa=True)
        if not estacoes.exists():
            self.stdout.write('Nenhuma estação tipo=online cadastrada — nada a coletar.')
            return

        coletadas = 0
        for estacao in estacoes:
            try:
                ponto = buscar_leitura_atual(estacao.latitude, estacao.longitude)

                # Open-Meteo não atualiza o dado "current" a cada poll
                # nosso — sem essa checagem, rodar a cada 10 min quando o
                # provedor só atualizou há 1h criaria Leitura duplicada
                # pro mesmo data_hora.
                if Leitura.objects.filter(estacao=estacao, data_hora=ponto['data_hora']).exists():
                    continue

                Leitura.objects.create(
                    sensor_id=estacao.identificador,
                    estacao=estacao,
                    temperatura=ponto['temperatura'],
                    umidade=ponto['umidade'],
                    pressao=ponto['pressao'],
                    dados_adicionais=ponto['dados_adicionais'],
                    data_hora=ponto['data_hora'],
                )
                estacao.ultima_transmissao_em = ponto['data_hora']
                estacao.save(update_fields=['ultima_transmissao_em'])
                coletadas += 1
            except (RequestException, DatabaseError) as erro:
                # Uma estação falhando (rede, Open-Meteo fora do ar) não
                # deve impedir as outras de serem coletadas neste ciclo.
                self.stdout.write(self.style.WARNING(f'Falha ao coletar "{estacao.identificador}": {erro}'))

        self.stdout.write(self.style.SUCCESS(f'{coletadas}/{estacoes.count()} estação(ões) online atualizada(s).'))
