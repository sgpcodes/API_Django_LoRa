from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from django.urls import include, path

from .views import (
    AssinaturaViewSet,
    AuditoriaRecenteView,
    CadastroView,
    ConfirmarEmailView,
    FuncionalidadeViewSet,
    InfoSistemaView,
    LimparDadosOperacionaisView,
    LimparLeiturasAntigasView,
    PlanoViewSet,
    RecredenciarView,
    ReenviarConfirmacaoPublicoView,
    ReenviarConfirmacaoView,
    TokenObtainPairComRoleView,
    UsuarioViewSet,
)

router = DefaultRouter()
router.register('contas', UsuarioViewSet, basename='conta')
router.register('funcionalidades', FuncionalidadeViewSet, basename='funcionalidade')
router.register('planos', PlanoViewSet, basename='plano')
router.register('assinaturas', AssinaturaViewSet, basename='assinatura')

urlpatterns = [
    # POST /api/auth/token/          -> login: usuário+senha -> {access, refresh}
    path('auth/token/', TokenObtainPairComRoleView.as_view(), name='token-obtain-pair'),
    # POST /api/auth/token/refresh/  -> troca um refresh token por um novo access token
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    # POST /api/auth/cadastro/       -> cadastro público (com plano OU token de credenciamento)
    path('auth/cadastro/', CadastroView.as_view(), name='cadastro'),
    # POST /api/auth/recredenciar/   -> logado, digita o token de credenciamento (novo ou pela 1a vez)
    path('auth/recredenciar/', RecredenciarView.as_view(), name='recredenciar'),
    # POST /api/auth/confirmar-email/     -> a pagina que o link do e-mail abre chama isso
    path('auth/confirmar-email/', ConfirmarEmailView.as_view(), name='confirmar-email'),
    # POST /api/auth/reenviar-confirmacao/ -> logado, pede o e-mail de confirmação de novo
    path('auth/reenviar-confirmacao/', ReenviarConfirmacaoView.as_view(), name='reenviar-confirmacao'),
    # POST /api/auth/reenviar-confirmacao-publico/ -> sem login (quem está travado sem conseguir entrar)
    path(
        'auth/reenviar-confirmacao-publico/',
        ReenviarConfirmacaoPublicoView.as_view(),
        name='reenviar-confirmacao-publico',
    ),
    # GET  -> prévia (dry-run) de quantos registros seriam apagados
    # POST {"confirmar": true} -> apaga de verdade. Gestor only.
    path(
        'manutencao/limpar-dados/',
        LimparDadosOperacionaisView.as_view(),
        name='limpar-dados-operacionais',
    ),
    # GET -> últimos eventos (estação cadastrada/usuários alterados) pra
    # alimentar a tela de Notificações do Gestor. Gestor only.
    path('auditoria/recentes/', AuditoriaRecenteView.as_view(), name='auditoria-recentes'),
    # GET -> tamanho do banco, contagem por tabela, atividade recente e
    # status das integrações externas. Gestor only.
    path('manutencao/info-sistema/', InfoSistemaView.as_view(), name='manutencao-info-sistema'),
    # GET ?dias= -> prévia de quantas leituras mais velhas que `dias` seriam
    # apagadas. POST {"dias":, "confirmar": true} -> apaga de verdade.
    path(
        'manutencao/limpar-leituras-antigas/',
        LimparLeiturasAntigasView.as_view(),
        name='limpar-leituras-antigas',
    ),
    path('', include(router.urls)),
]
