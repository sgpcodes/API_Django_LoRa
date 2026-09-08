from django.db import migrations


def copiar_dono_para_usuarios(apps, schema_editor):
    Estacao = apps.get_model('api_rest', 'Estacao')
    for estacao in Estacao.objects.exclude(dono__isnull=True):
        estacao.usuarios.add(estacao.dono_id)


def copiar_usuarios_para_dono(apps, schema_editor):
    """Reverso: só pra permitir `migrate` andar pra trás em dev — pega
    qualquer um dos usuários vinculados como "o" dono (a distinção não
    existe mais, então não há um valor "certo" único aqui)."""
    Estacao = apps.get_model('api_rest', 'Estacao')
    for estacao in Estacao.objects.all():
        primeiro = estacao.usuarios.first()
        if primeiro is not None:
            estacao.dono_id = primeiro.id
            estacao.save(update_fields=['dono_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('api_rest', '0006_estacao_usuarios_m2m'),
    ]

    operations = [
        migrations.RunPython(copiar_dono_para_usuarios, copiar_usuarios_para_dono),
    ]
