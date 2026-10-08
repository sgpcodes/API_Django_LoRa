"""
Cliente da Open-Meteo pro lado do BACKEND — usado só pelas Estacao com
tipo=online (ver Estacao.tipo em models.py). Mesma API pública que o
frontend já usa direto no navegador pro Dashboard "antigo"
(frontend/src/services/climaExternoService.js), mas aqui o resultado é
persistido como Leitura (ver management/commands/coletar_dados_online.py
e backfill_historico_estacao.py) em vez de só aparecer na tela.

Pede sempre timezone=UTC (diferente do frontend, que pede
America/Sao_Paulo pra exibição) — mais simples de guardar como
datetime timezone-aware sem lidar com horário de verão/offset na mão; a
conversão pro fuso de exibição já é feita pelo frontend na hora de
formatar, como qualquer outro campo `data_hora` de Leitura.
"""
from datetime import datetime, timezone as dt_timezone

import requests

BASE_URL = 'https://api.open-meteo.com/v1/forecast'
TIMEOUT = 10

_CAMPOS_COMUNS = [
    'temperature_2m', 'relative_humidity_2m', 'surface_pressure',
    'precipitation', 'shortwave_radiation',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
]


def _parse_data_hora(valor_iso):
    return datetime.fromisoformat(valor_iso).replace(tzinfo=dt_timezone.utc)


def _normalizar_ponto(bloco, indice=None):
    """`bloco` é o dict `current` (indice=None) ou um dos arrays paralelos
    de `hourly` (indice = posição na lista)."""
    def valor(campo):
        bruto = bloco[campo]
        return bruto if indice is None else bruto[indice]

    return {
        'temperatura': valor('temperature_2m'),
        'umidade': valor('relative_humidity_2m'),
        'pressao': valor('surface_pressure'),
        'dados_adicionais': {
            'chuva': valor('precipitation'),
            'radiacao': valor('shortwave_radiation'),
            'vento': {
                'velocidade': valor('wind_speed_10m'),
                'direcao': valor('wind_direction_10m'),
                'rajada': valor('wind_gusts_10m'),
            },
        },
        'data_hora': _parse_data_hora(valor('time')),
    }


def buscar_leitura_atual(latitude, longitude):
    """Uma leitura só, a mais recente disponível agora — usado pelo
    comando coletar_dados_online, chamado a cada ~10 min."""
    resposta = requests.get(BASE_URL, params={
        'latitude': latitude,
        'longitude': longitude,
        'current': ','.join(_CAMPOS_COMUNS),
        'timezone': 'UTC',
    }, timeout=TIMEOUT)
    resposta.raise_for_status()
    return _normalizar_ponto(resposta.json()['current'])


def buscar_historico(latitude, longitude, past_days=30):
    """Uma leitura por hora dos últimos `past_days` dias — usado uma vez
    só, no backfill de uma estação online recém-criada (ver
    backfill_historico_estacao.py). forecast_days=0: aqui é só histórico,
    não precisa do lado "previsão" que o Dashboard busca ao vivo."""
    resposta = requests.get(BASE_URL, params={
        'latitude': latitude,
        'longitude': longitude,
        'hourly': ','.join(_CAMPOS_COMUNS),
        'past_days': str(past_days),
        'forecast_days': '0',
        'timezone': 'UTC',
    }, timeout=TIMEOUT)
    resposta.raise_for_status()
    hourly = resposta.json()['hourly']
    return [_normalizar_ponto(hourly, indice=i) for i in range(len(hourly['time']))]
