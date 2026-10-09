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
from django.utils import timezone
from requests import RequestException

from api_rest.models import Estacao, Leitura
from api_rest.open_meteo import buscar_leitura_atual


def precisa_atualizar(estacao):
    """True se uma Estacao tipo=online está velha o bastante pra valer a
    pena gastar 1 pedido na Open-Meteo — usa o `intervalo_envio_minutos`
    da PRÓPRIA estação (1h por padrão pra online, ver
    EstacaoSerializer.validate), não um número fixo pra todas. Função
    solta de propósito: reaproveitada tanto aqui (loop de fundo) quanto
    em EstacaoViewSet (atualização ao abrir a lista/detalhe) — sem isso
    duplicado, o loop insistia em TODA estação a cada 10 min mesmo numa
    configurada pra 1h, desperdiçando cota da Open-Meteo à toa."""
    if estacao.tipo != Estacao.Tipo.ONLINE or not estacao.ativa:
        return False
    if estacao.ultima_transmissao_em is None:
        return True
    limite = timezone.now() - timezone.timedelta(minutes=estacao.intervalo_envio_minutos)
    return estacao.ultima_transmissao_em < limite


def coletar_estacao(estacao):
    """Busca a leitura mais recente da Open-Meteo pra UMA Estacao
    tipo=online e grava como Leitura, se for um dado novo. Função solta
    (não método de Command) de propósito — reaproveitada por
    EstacaoViewSet (api_rest/views.py) pra atualizar uma estação na hora
    em que alguém abre a lista/detalhe dela, sem depender só do loop de
    fundo rodando certinho no servidor (ver ONLINE_COLLECT_INTERVAL_SECONDS
    em docker/backend/entrypoint.sh / render.yaml).

    Levanta RequestException/DatabaseError pro chamador decidir o que
    fazer com a falha (o comando de loop só avisa e segue pra próxima
    estação; a view engole silenciosamente — uma Open-Meteo fora do ar
    não pode derrubar a tela de Estações/Dashboard inteira).
    """
    ponto = buscar_leitura_atual(estacao.latitude, estacao.longitude)

    # Open-Meteo não atualiza o dado "current" a cada poll nosso — sem
    # essa checagem, rodar a cada 10 min quando o provedor só atualizou
    # há 1h criaria Leitura duplicada pro mesmo data_hora.
    if Leitura.objects.filter(estacao=estacao, data_hora=ponto['data_hora']).exists():
        return False

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
    return True


class Command(BaseCommand):
    help = 'Busca a leitura mais recente da Open-Meteo para cada Estacao tipo=online e grava como Leitura.'

    def handle(self, *args, **options):
        estacoes = Estacao.objects.filter(tipo=Estacao.Tipo.ONLINE, ativa=True)
        if not estacoes.exists():
            self.stdout.write('Nenhuma estação tipo=online cadastrada — nada a coletar.')
            return

        coletadas = 0
        tentadas = 0
        for estacao in estacoes:
            if not precisa_atualizar(estacao):
                continue
            tentadas += 1
            try:
                if coletar_estacao(estacao):
                    coletadas += 1
            except (RequestException, DatabaseError) as erro:
                # Uma estação falhando (rede, Open-Meteo fora do ar) não
                # deve impedir as outras de serem coletadas neste ciclo.
                self.stdout.write(self.style.WARNING(f'Falha ao coletar "{estacao.identificador}": {erro}'))

        self.stdout.write(self.style.SUCCESS(
            f'{coletadas}/{tentadas} estação(ões) online atualizada(s) '
            f'({estacoes.count() - tentadas} já estavam frescas, puladas).',
        ))
