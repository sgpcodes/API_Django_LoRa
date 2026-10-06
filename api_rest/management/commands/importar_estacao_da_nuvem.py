"""
Puxa uma Estacao (e os Usuarios vinculados a ela) do banco da nuvem
('nuvem', configurado via CLOUD_DATABASE_URL) pra dentro do banco local
('default') — passo único, feito na hora de configurar a Raspberry Pi
pra que ela já "conheça" a estação que vai operar offline.

Depois disso, as leituras que chegarem localmente (via ESP32 apontando
pra Pi) já resolvem `estacao` certo, e o `sincronizar_leituras` sabe pra
qual Estacao da nuvem mandar os dados de volta, casando pelo campo
`identificador` (não pelo id interno, que pode ser diferente em cada
banco).

Uso:
    python manage.py importar_estacao_da_nuvem ESP32_01
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.db.utils import OperationalError

from api_rest.models import Estacao

CAMPOS_ESTACAO = [
    'nome', 'localizacao', 'token_hash', 'intervalo_envio_minutos',
    'limite_offline_minutos', 'ultima_transmissao_em', 'ativa',
]

CAMPOS_USUARIO = [
    'email', 'password', 'first_name', 'last_name', 'role', 'telefone',
    'cep', 'rua', 'numero', 'cidade', 'estado', 'cpf', 'email_verificado',
    'credenciamento_versao', 'is_active', 'is_staff', 'is_superuser',
]


class Command(BaseCommand):
    help = 'Importa uma Estacao e seus Usuarios do banco da nuvem para o banco local da Raspberry Pi.'

    def add_arguments(self, parser):
        parser.add_argument('identificador', help='Identificador da estação, ex.: ESP32_01.')

    def handle(self, *args, **options):
        if 'nuvem' not in connections.databases:
            raise CommandError(
                'CLOUD_DATABASE_URL não está configurada — defina essa variável de ambiente '
                '(veja .env.docker.example) antes de importar.',
            )

        identificador = options['identificador']

        try:
            estacao_nuvem = Estacao.objects.using('nuvem').filter(identificador=identificador).first()
        except OperationalError as erro:
            raise CommandError(f'Não foi possível conectar à nuvem: {erro}')

        if estacao_nuvem is None:
            raise CommandError(f'Nenhuma estação com identificador "{identificador}" encontrada na nuvem.')

        estacao_local, criada = Estacao.objects.update_or_create(
            identificador=identificador,
            defaults={campo: getattr(estacao_nuvem, campo) for campo in CAMPOS_ESTACAO},
        )
        self.stdout.write(self.style.SUCCESS(
            f'{"Criada" if criada else "Atualizada"} localmente: {estacao_local} (id local={estacao_local.id})',
        ))

        Usuario = get_user_model()
        usuarios_importados = 0
        for usuario_nuvem in estacao_nuvem.usuarios.using('nuvem').all():
            usuario_local, _ = Usuario.objects.update_or_create(
                username=usuario_nuvem.username,
                defaults={campo: getattr(usuario_nuvem, campo) for campo in CAMPOS_USUARIO},
            )
            estacao_local.usuarios.add(usuario_local)
            usuarios_importados += 1
            self.stdout.write(f'  usuário importado: {usuario_local.username} ({usuario_local.get_role_display()})')

        self.stdout.write(self.style.SUCCESS(
            f'Pronto: estação "{identificador}" e {usuarios_importados} usuário(s) disponíveis localmente.',
        ))
