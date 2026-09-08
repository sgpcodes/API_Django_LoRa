from unittest.mock import Mock, patch

from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from contas.models import Usuario


def _resposta_mock(json_data):
    resposta = Mock()
    resposta.json.return_value = json_data
    resposta.raise_for_status.return_value = None
    return resposta


ESTACOES_BRUTO = [
    {
        'CD_ESTACAO': 'A652',
        'DC_NOME': 'RIO DE JANEIRO - FORTE DE COPACABANA',
        'SG_ESTADO': 'RJ',
        'VL_LATITUDE': '-22.98',
        'VL_LONGITUDE': '-43.19',
        'VL_ALTITUDE': '4.8',
        'CD_SITUACAO': 'Operante',
    },
    {
        'CD_ESTACAO': 'A001',
        'DC_NOME': 'BRASILIA',
        'SG_ESTADO': 'DF',
        'VL_LATITUDE': '-15.78',
        'VL_LONGITUDE': '-47.93',
        'VL_ALTITUDE': '1160.0',
        'CD_SITUACAO': 'Pane',
    },
]

PREVISAO_BRUTO = {
    '3304557': {
        '08/16/2026': {
            'manha': {
                'resumo': 'Nublado', 'temp_max': 28, 'temp_min': 22,
                'umidade_max': 90, 'umidade_min': 60,
                'dir_vento': 'NE', 'int_vento': 'Fraco',
                'cod_icone': 'pn', 'dia_semana': 'domingo',
            },
        },
        '08/18/2026': {
            'resumo': 'Sol com algumas nuvens', 'temp_max': 30, 'temp_min': 21,
            'umidade_max': 85, 'umidade_min': 55,
            'dir_vento': 'E', 'int_vento': 'Moderado',
            'cod_icone': 'cn', 'dia_semana': 'terça-feira',
        },
    },
}

AVISOS_BRUTO = {
    'hoje': [
        {
            'id_aviso': '123', 'descricao': 'Chuvas Intensas', 'severidade': 'Perigo Potencial',
            'aviso_cor': '#FFC107', 'riscos': ['Alagamentos'], 'instrucoes': ['Evite áreas de risco'],
            'data_inicio': '2026-08-16', 'data_fim': '2026-08-17',
            'hora_inicio': '10:00', 'hora_fim': '10:00',
            'estados': 'RJ,SP', 'municipios': 'Rio de Janeiro (RJ)',
        },
    ],
    'futuro': [],
}


class ClimaExternoAuthTests(APITestCase):
    def test_endpoints_exigem_autenticacao(self):
        for url in ('/api/inmet/estacoes/', '/api/inmet/previsao/3304557/', '/api/inmet/avisos/'):
            resposta = self.client.get(url)
            self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED, url)


class EstacoesInmetViewTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.usuario = Usuario.objects.create_user(username='usuario1', password='x')
        self.client.force_authenticate(self.usuario)

    @patch('clima_externo.views.requests.get')
    def test_lista_todas_as_estacoes_normalizadas(self, mock_get):
        mock_get.return_value = _resposta_mock(ESTACOES_BRUTO)
        resposta = self.client.get('/api/inmet/estacoes/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta.data), 2)
        self.assertEqual(resposta.data[0]['codigo'], 'A652')
        self.assertTrue(resposta.data[0]['operante'])
        self.assertFalse(resposta.data[1]['operante'])

    @patch('clima_externo.views.requests.get')
    def test_filtra_por_uf(self, mock_get):
        mock_get.return_value = _resposta_mock(ESTACOES_BRUTO)
        resposta = self.client.get('/api/inmet/estacoes/?uf=rj')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta.data), 1)
        self.assertEqual(resposta.data[0]['uf'], 'RJ')

    @patch('clima_externo.views.requests.get')
    def test_segunda_chamada_usa_cache_sem_bater_no_inmet_de_novo(self, mock_get):
        mock_get.return_value = _resposta_mock(ESTACOES_BRUTO)
        self.client.get('/api/inmet/estacoes/')
        self.client.get('/api/inmet/estacoes/?uf=DF')
        self.assertEqual(mock_get.call_count, 1)


class PrevisaoInmetViewTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.usuario = Usuario.objects.create_user(username='usuario1', password='x')
        self.client.force_authenticate(self.usuario)

    @patch('clima_externo.views.requests.get')
    def test_previsao_normalizada_por_periodo(self, mock_get):
        mock_get.return_value = _resposta_mock(PREVISAO_BRUTO)
        resposta = self.client.get('/api/inmet/previsao/3304557/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['codigo_ibge'], '3304557')
        dia_hoje = resposta.data['dias'][0]
        self.assertEqual(dia_hoje['manha']['temp_max'], 28)
        self.assertEqual(dia_hoje['manha']['condicao'], 'chuva')

        dia_futuro = resposta.data['dias'][1]
        self.assertNotIn('manha', dia_futuro)
        self.assertEqual(dia_futuro['dia_inteiro']['temp_max'], 30)
        self.assertEqual(dia_futuro['dia_inteiro']['condicao'], 'parcialmente-nublado')


class AvisosInmetViewTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.usuario = Usuario.objects.create_user(username='usuario1', password='x')
        self.client.force_authenticate(self.usuario)

    @patch('clima_externo.views.requests.get')
    def test_avisos_normalizados(self, mock_get):
        mock_get.return_value = _resposta_mock(AVISOS_BRUTO)
        resposta = self.client.get('/api/inmet/avisos/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta.data['hoje']), 1)
        self.assertEqual(resposta.data['hoje'][0]['estados'], ['RJ', 'SP'])

    @patch('clima_externo.views.requests.get')
    def test_filtra_avisos_por_uf(self, mock_get):
        mock_get.return_value = _resposta_mock(AVISOS_BRUTO)
        resposta_rj = self.client.get('/api/inmet/avisos/?uf=RJ')
        self.assertEqual(len(resposta_rj.data['hoje']), 1)

        resposta_mg = self.client.get('/api/inmet/avisos/?uf=MG')
        self.assertEqual(len(resposta_mg.data['hoje']), 0)
