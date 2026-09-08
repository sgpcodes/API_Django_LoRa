"""
URL configuration for api_root project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    # Login (JWT), CRUD de Usuário/Plano/Funcionalidade/Assinatura.
    path('api/', include('contas.urls')),
    # Telemetria: leituras, RSSI, Estações.
    path('api/', include('api_rest.urls')),
    # Clima externo: proxy do INMET (aba "Clima INMET" do Usuário).
    path('api/', include('clima_externo.urls')),
]
