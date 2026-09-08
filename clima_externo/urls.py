from django.urls import path

from .views import AvisosInmetView, EstacoesInmetView, PrevisaoInmetView

urlpatterns = [
    # GET /api/inmet/estacoes/?uf=RJ -> lista de estações automáticas do INMET
    path('inmet/estacoes/', EstacoesInmetView.as_view(), name='inmet-estacoes'),
    # GET /api/inmet/previsao/<codigo_ibge>/ -> previsão de 5 dias (2 por período, 3 diária)
    path('inmet/previsao/<str:codigo_ibge>/', PrevisaoInmetView.as_view(), name='inmet-previsao'),
    # GET /api/inmet/avisos/?uf=RJ -> avisos oficiais ativos
    path('inmet/avisos/', AvisosInmetView.as_view(), name='inmet-avisos'),
]
