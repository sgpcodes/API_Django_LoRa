from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    EstacaoViewSet,
    LeituraDetailView,
    LeituraListCreateView,
    LeiturasOrfasPorSensorView,
    RssiSolicitarView,
    RssiStatusView,
)

router = DefaultRouter()
# GET/POST /api/estacoes/, GET/PUT/PATCH/DELETE /api/estacoes/<id>/
router.register('estacoes', EstacaoViewSet, basename='estacao')

urlpatterns = [
    # GET  /api/leituras/            -> lista todas (ou filtra com ?sensor_id=...)
    # POST /api/leituras/            -> recebe uma leitura enviada pela ESP32 receptora
    path('leituras/', LeituraListCreateView.as_view(), name='leitura-list-create'),

    # Alias sem barra final: o ESP32 (HTTPClient) não segue redirect 301 em
    # POST, então "/api/leituras" precisa funcionar igual a "/api/leituras/".
    path('leituras', LeituraListCreateView.as_view()),

    # GET /api/leituras/<id>/        -> busca uma leitura pelo ID
    path('leituras/<str:leitura_id>/', LeituraDetailView.as_view(), name='leitura-detail'),

    # DELETE /api/leituras/orfas/<sensor_id>/ -> apaga leituras soltas (sem estação) de um sensor_id
    path('leituras/orfas/<str:sensor_id>/', LeiturasOrfasPorSensorView.as_view(), name='leituras-orfas-por-sensor'),

    # GET  /api/rssi/status/         -> o ESP32 consulta a cada check-in se há pedido pendente
    # POST /api/rssi/solicitar/      -> o botão "Analisar" do dashboard marca um pedido como pendente
    path('rssi/status/', RssiStatusView.as_view(), name='rssi-status'),
    path('rssi/solicitar/', RssiSolicitarView.as_view(), name='rssi-solicitar'),

    path('', include(router.urls)),
]
