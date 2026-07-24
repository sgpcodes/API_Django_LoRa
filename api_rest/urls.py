from django.urls import path

from .views import LeituraDetailView, LeituraListCreateView

urlpatterns = [
    # GET  /api/leituras/            -> lista todas (ou filtra com ?sensor_id=...)
    # POST /api/leituras/            -> recebe uma leitura enviada pela ESP32 receptora
    path('leituras/', LeituraListCreateView.as_view(), name='leitura-list-create'),

    # Alias sem barra final: o ESP32 (HTTPClient) não segue redirect 301 em
    # POST, então "/api/leituras" precisa funcionar igual a "/api/leituras/".
    path('leituras', LeituraListCreateView.as_view()),

    # GET /api/leituras/<id>/        -> busca uma leitura pelo ID
    path('leituras/<str:leitura_id>/', LeituraDetailView.as_view(), name='leitura-detail'),
]
