# Semeia a versão 1 do token de credenciamento com o valor combinado
# provisoriamente ("Lacop22") — trocar depois é um `TokenCredenciamento.
# rotacionar()` (ex.: via admin), nunca editando esta linha.

from django.contrib.auth.hashers import make_password
from django.db import migrations

TOKEN_INICIAL = 'Lacop22'


def semear(apps, schema_editor):
    TokenCredenciamento = apps.get_model('contas', 'TokenCredenciamento')
    TokenCredenciamento.objects.get_or_create(
        versao=1, defaults={'token_hash': make_password(TOKEN_INICIAL)},
    )


def reverter(apps, schema_editor):
    TokenCredenciamento = apps.get_model('contas', 'TokenCredenciamento')
    TokenCredenciamento.objects.filter(versao=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('contas', '0003_tokencredenciamento_usuario_cpf_and_more'),
    ]

    operations = [
        migrations.RunPython(semear, reverter),
    ]
