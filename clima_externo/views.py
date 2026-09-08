"""Proxy fino para a API pública do INMET (Instituto Nacional de Meteorologia).

Fica em um app separado (`clima_externo`) porque é dado meteorológico
oficial de terceiros, para a aba "Clima INMET" do app do Usuário — não se
mistura com `api_rest` (dado da própria estação ESP32 da usuária).

Views passam por aqui em vez de o front chamar o INMET direto por dois
motivos: (1) evita depender do CORS do INMET, que não é garantido pra API
de governo; (2) permite cachear a resposta (`django.core.cache.cache`,
LocMemCache padrão do projeto) e não bater no INMET a cada carregamento de
página de cada usuária.

O endpoint de leituras horárias por estação (`/estacao/{inicio}/{fim}/{cod}`)
foi investigado e está protegido por bot-defense do INMET (sempre retorna
204 vazio pra chamadas de servidor) — por isso não há view de leitura/
histórico aqui; a estação de referência é exposta só com metadados
(identificação/localização/status), sem valores de leitura ao vivo.
"""
import requests

from django.core.cache import cache

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

TIMEOUT = 10

ESTACOES_URL = 'https://apitempo.inmet.gov.br/estacoes/T'
PREVISAO_URL = 'https://apiprevmet3.inmet.gov.br/previsao/{codigo_ibge}'
AVISOS_URL = 'https://apiprevmet3.inmet.gov.br/avisos/ativos'

CACHE_TTL_ESTACOES = 60 * 60 * 24  # 1 dia: lista de estações quase não muda.
CACHE_TTL_PREVISAO = 60 * 60 * 2  # 2h.
CACHE_TTL_AVISOS = 60 * 15  # 15min.


def _normalizar_estacao(bruto):
    return {
        'codigo': bruto.get('CD_ESTACAO'),
        'nome': bruto.get('DC_NOME'),
        'uf': bruto.get('SG_ESTADO'),
        'latitude': bruto.get('VL_LATITUDE'),
        'longitude': bruto.get('VL_LONGITUDE'),
        'altitude': bruto.get('VL_ALTITUDE'),
        'situacao': bruto.get('CD_SITUACAO'),
        'operante': bruto.get('CD_SITUACAO') == 'Operante',
    }


class EstacoesInmetView(APIView):
    """GET /api/inmet/estacoes/?uf=RJ

    Sem "uf", devolve todas (usado pelo mapa). Com "uf", filtra (usado no
    seletor de estação de referência)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'inmet:estacoes:todas'
        estacoes = cache.get(cache_key)
        if estacoes is None:
            resposta = requests.get(ESTACOES_URL, timeout=TIMEOUT)
            resposta.raise_for_status()
            estacoes = [_normalizar_estacao(item) for item in resposta.json()]
            cache.set(cache_key, estacoes, CACHE_TTL_ESTACOES)

        uf = request.query_params.get('uf', '').strip().upper()
        if uf:
            estacoes = [item for item in estacoes if item['uf'] == uf]
        return Response(estacoes)


def _icone_para_condicao(codigo_icone):
    """Mapeia o `cod_icone` do INMET pra uma condição textual simples, que o
    front usa pra escolher um ícone do lucide-react — em vez de renderizar
    a imagem base64 que o INMET manda, mantendo consistência visual com o
    resto do sistema."""
    codigo = (codigo_icone or '').lower()
    if 'pn' in codigo or 'pc' in codigo:
        return 'chuva'
    if 'tc' in codigo or 'ts' in codigo:
        return 'tempestade'
    if 'nv' in codigo or 'en' in codigo:
        return 'nublado'
    if 'cn' in codigo:
        return 'parcialmente-nublado'
    return 'sol'


def _normalizar_periodo(bruto, chave_prefixo):
    return {
        'resumo': bruto.get('resumo'),
        'temp_max': bruto.get('temp_max'),
        'temp_min': bruto.get('temp_min'),
        'umidade_max': bruto.get('umidade_max'),
        'umidade_min': bruto.get('umidade_min'),
        'dir_vento': bruto.get('dir_vento'),
        'int_vento': bruto.get('int_vento'),
        'condicao': _icone_para_condicao(bruto.get('cod_icone')),
    }


class PrevisaoInmetView(APIView):
    """GET /api/inmet/previsao/<codigo_ibge>/ — previsão de 5 dias. Os 2
    primeiros dias (hoje/amanhã) vêm divididos em manhã/tarde/noite; os 3
    seguintes vêm como um resumo único do dia inteiro (sem essa divisão) —
    os dois formatos são normalizados aqui."""

    permission_classes = [IsAuthenticated]

    def get(self, request, codigo_ibge):
        cache_key = f'inmet:previsao:{codigo_ibge}'
        dias = cache.get(cache_key)
        if dias is None:
            url = PREVISAO_URL.format(codigo_ibge=codigo_ibge)
            resposta = requests.get(url, timeout=TIMEOUT)
            resposta.raise_for_status()
            bruto = resposta.json()
            dados_ibge = bruto.get(str(codigo_ibge), {})

            dias = []
            for data, conteudo in dados_ibge.items():
                dia = {'data': data, 'dia_semana': conteudo.get('dia_semana')}
                if 'manha' in conteudo:
                    for periodo in ('manha', 'tarde', 'noite'):
                        if periodo in conteudo:
                            dia[periodo] = _normalizar_periodo(conteudo[periodo], periodo)
                            dia['dia_semana'] = dia['dia_semana'] or conteudo[periodo].get('dia_semana')
                else:
                    dia['dia_inteiro'] = _normalizar_periodo(conteudo, 'dia_inteiro')
                dias.append(dia)
            cache.set(cache_key, dias, CACHE_TTL_PREVISAO)

        return Response({'codigo_ibge': codigo_ibge, 'dias': dias})


class AvisosInmetView(APIView):
    """GET /api/inmet/avisos/?uf=RJ — avisos oficiais ativos (hoje + futuro),
    filtrados pelo campo "estados" (lista separada por vírgula) que cada
    aviso já traz — não precisa de um código de área separado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = 'inmet:avisos:ativos'
        avisos = cache.get(cache_key)
        if avisos is None:
            resposta = requests.get(AVISOS_URL, timeout=TIMEOUT)
            resposta.raise_for_status()
            bruto = resposta.json()
            avisos = {
                'hoje': [_normalizar_aviso(item) for item in bruto.get('hoje', [])],
                'futuro': [_normalizar_aviso(item) for item in bruto.get('futuro', [])],
            }
            cache.set(cache_key, avisos, CACHE_TTL_AVISOS)

        uf = request.query_params.get('uf', '').strip().upper()
        if uf:
            avisos = {
                periodo: [item for item in lista if uf in item['estados']]
                for periodo, lista in avisos.items()
            }
        return Response(avisos)


def _normalizar_aviso(bruto):
    estados_raw = bruto.get('estados') or ''
    return {
        'id': bruto.get('id_aviso') or bruto.get('id'),
        'descricao': bruto.get('descricao'),
        'severidade': bruto.get('severidade'),
        'cor': bruto.get('aviso_cor'),
        'riscos': bruto.get('riscos') or [],
        'instrucoes': bruto.get('instrucoes') or [],
        'data_inicio': bruto.get('data_inicio'),
        'data_fim': bruto.get('data_fim'),
        'hora_inicio': bruto.get('hora_inicio'),
        'hora_fim': bruto.get('hora_fim'),
        'estados': [uf.strip() for uf in estados_raw.split(',') if uf.strip()],
        'municipios': bruto.get('municipios'),
    }
