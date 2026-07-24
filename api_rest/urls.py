from django.urls import path

from .views import LeituraDetailView, LeituraListCreateView

urlpatterns = [
    # GET  /api/leituras/            -> lista todas (ou filtra com ?sensor_id=...)
    # POST /api/leituras/            -> recebe uma leitura enviada pela ESP32 receptora
    path('leituras/', LeituraListCreateView.as_view(), name='leitura-list-create'),

    # GET /api/leituras/<id>/        -> busca uma leitura pelo ID
    path('leituras/<str:leitura_id>/', LeituraDetailView.as_view(), name='leitura-detail'),
]
