# Preço mensal dos planos semeados em 0002_seed_planos (ficaram sem preço
# porque na época não existia tela de cadastro cobrando isso). Valores
# alinhados com a proposta de "entrada gratuita" (RN21: Standard
# gratuito/baixo custo) — ajustável pelo Gestor no admin a qualquer
# momento, isso aqui é só o valor inicial.

from django.db import migrations

PRECOS = {'Standard': 0, 'Pro': 49, 'Plus': 99}


def aplicar(apps, schema_editor):
    Plano = apps.get_model('contas', 'Plano')
    for nome, preco in PRECOS.items():
        Plano.objects.filter(nome=nome).update(preco_mensal=preco)


def reverter(apps, schema_editor):
    Plano = apps.get_model('contas', 'Plano')
    Plano.objects.filter(nome__in=PRECOS.keys()).update(preco_mensal=None)


class Migration(migrations.Migration):

    dependencies = [
        ('contas', '0004_seed_token_credenciamento'),
    ]

    operations = [
        migrations.RunPython(aplicar, reverter),
    ]
