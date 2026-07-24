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
        _client = MongoClient(settings.MONGO_URI)

    banco = _client[settings.MONGO_DB_NAME]
    return banco['leituras']
