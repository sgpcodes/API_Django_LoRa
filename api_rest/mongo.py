"""
Conexão com o MongoDB.

Mantemos aqui uma única instância do cliente (MongoClient), reaproveitada
em todas as requisições, em vez de abrir uma conexão nova a cada chamada.
"""
from pymongo import MongoClient
from django.conf import settings

_client = None


def get_collection():
    """Retorna a collection do MongoDB onde as leituras são salvas."""
    global _client
    if _client is None:
        # tz_aware=True: sem isso, o pymongo devolve datetimes "naive" (sem
        # fuso), e o frontend interpreta o horário UTC como se já fosse hora
        # local, causando um desvio de horas no "última atualização".
        _client = MongoClient(settings.MONGO_URI, tz_aware=True)

    banco = _client[settings.MONGO_DB_NAME]
    return banco['leituras']
