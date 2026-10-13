"""
Puxa da nuvem ('nuvem', configurado via CLOUD_DATABASE_URL) TODOS os
Usuarios e TODAS as Estacoes pro banco local ('default') — mão única,
nuvem -> local, em loop (ver docker/backend/entrypoint.sh), pra que
qualquer conta consiga logar e operar a Raspberry estando perto dela,
mesmo sem internet e mesmo pra contas/estações criadas depois da Pi já
estar em campo.

Diferente de `importar_estacao_da_nuvem` (que traz uma estação — e só os
usuários vinculados a ela — de uma vez, num passo manual único de
configuração inicial), este comando traz TUDO, continuamente, sem exigir
que a conta esteja vinculada a nenhuma estação em particular (um Gestor,
por exemplo, não precisa estar vinculado a estação nenhuma pra ter acesso
a todas — RN01).

Não apaga nem mexe em nada que exista só localmente (ex.: um cadastro
feito direto na Pi, ainda sem internet pra ter ido pra nuvem).

Se CLOUD_DATABASE_URL não estiver configurada, ou se a nuvem estiver
inacessível agora, o comando simplesmente não faz nada (sem erro).

Uso:
    python manage.py sincronizar_cadastros
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

from api_rest.models import Estacao

CAMPOS_ESTACAO = [
    'nome', 'localizacao', 'token_hash', 'tipo', 'latitude', 'longitude',
    'intervalo_envio_minutos', 'limite_offline_minutos', 'ultima_transmissao_em', 'ativa',
]

CAMPOS_USUARIO = [
    'email', 'password', 'first_name', 'last_name', 'role', 'telefone',
    'cep', 'rua', 'numero', 'cidade', 'estado', 'cpf', 'email_verificado',
    'credenciamento_versao', 'is_active', 'is_staff', 'is_superuser',
]


def nuvem_disponivel():
    if 'nuvem' not in connections.databases:
        return False
    try:
        connections['nuvem'].cursor()
        return True
    except OperationalError:
        return False


class Command(BaseCommand):
    help = 'Sincroniza (nuvem -> local) todos os Usuarios e Estacoes, pra login/gestão funcionarem offline.'

    def handle(self, *args, **options):
        if not nuvem_disponivel():
            self.stdout.write('Nuvem inacessível agora — tentando de novo no próximo ciclo.')
            return

        try:
            usuarios_sincronizados = self._sincronizar_usuarios()
            estacoes_sincronizadas = self._sincronizar_estacoes()
        except OperationalError:
            self.stdout.write(self.style.WARNING('Conexão com a nuvem caiu durante a sincronização de cadastros.'))
            return

        self.stdout.write(self.style.SUCCESS(
            f'{usuarios_sincronizados} usuário(s) e {estacoes_sincronizadas} estação(ões) sincronizados da nuvem.',
        ))

    def _sincronizar_usuarios(self):
        Usuario = get_user_model()
        total = 0
        for usuario_nuvem in Usuario.objects.using('nuvem').all():
            Usuario.objects.update_or_create(
                username=usuario_nuvem.username,
                defaults={campo: getattr(usuario_nuvem, campo) for campo in CAMPOS_USUARIO},
            )
            total += 1
        return total

    def _sincronizar_estacoes(self):
        Usuario = get_user_model()
        total = 0
        for estacao_nuvem in Estacao.objects.using('nuvem').all():
            estacao_local, _ = Estacao.objects.update_or_create(
                identificador=estacao_nuvem.identificador,
                defaults={campo: getattr(estacao_nuvem, campo) for campo in CAMPOS_ESTACAO},
            )

            usernames = list(estacao_nuvem.usuarios.using('nuvem').values_list('username', flat=True))
            estacao_local.usuarios.set(Usuario.objects.filter(username__in=usernames))
            total += 1
        return total
