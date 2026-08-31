"""
Classes de permissão do DRF que implementam o controle de acesso descrito
nas seções 2 e 3 do documento de regras de negócio (RN01, RN06, RN07,
RN11, RN19).
"""

from rest_framework.permissions import BasePermission

from .models import Estacao


class EhGestor(BasePermission):
    """RN01: o Gestor tem acesso irrestrito a tudo, independente do plano."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.eh_gestor)


class EhGestorOuDonoDaEstacao(BasePermission):
    """RN06/RN07: um Usuário só acessa dados de estações explicitamente
    vinculadas a ele; o Gestor sempre passa (RN01).

    `obj` pode ser a própria Estacao ou qualquer objeto que tenha um
    atributo `estacao` (ex.: uma Leitura) — cobre os dois casos com a
    mesma classe.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.eh_gestor:
            return True
        estacao = obj if isinstance(obj, Estacao) else getattr(obj, 'estacao', None)
        return estacao is not None and estacao.dono_id == user.id


class RecursoDoPlano(BasePermission):
    """RN09/RN11: bloqueia o acesso a um recurso que não está incluso no
    plano do Usuário, sem vazar nenhum dado do recurso bloqueado — a view
    só precisa declarar o atributo de classe `recurso_requerido` com o
    `codigo` da Funcionalidade (contas.models.Funcionalidade) que ela
    exige. Views sem esse atributo não são afetadas por esta regra.

    Também cobre RN06 (assinatura em dia): se o Usuário não tiver uma
    Assinatura ativa, o acesso é negado do mesmo jeito — trata "sem
    assinatura ativa" e "plano sem esse recurso" com a mesma resposta de
    upsell, para não revelar detalhe de billing numa checagem de feature.
    """

    message = {
        'status': 'upsell',
        'message': 'Este recurso não está incluído no seu plano atual.',
    }

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.eh_gestor:
            return True

        recurso = getattr(view, 'recurso_requerido', None)
        if recurso is None:
            return True

        # Import local para evitar import cruzado no topo do módulo entre
        # api_rest e contas (contas não depende de api_rest, e vice-versa
        # só aqui, dentro da função, quando realmente precisa).
        from contas.models import Assinatura

        assinatura = Assinatura.objects.filter(
            usuario=user, encerrada_em__isnull=True,
        ).select_related('plano').first()

        if assinatura is None or assinatura.status != Assinatura.Status.ATIVA:
            return False

        return assinatura.plano.funcionalidades.filter(codigo=recurso).exists()
