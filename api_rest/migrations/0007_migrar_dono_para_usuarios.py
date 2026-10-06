from django.db import migrations


def copiar_dono_para_usuarios(apps, schema_editor):
    # .using(alias): sem isso, as consultas abaixo caem no banco 'default'
    # em vez do banco que está de fato sendo migrado (relevante ao rodar
    # `migrate --database=nuvem` na sincronização da Raspberry Pi — sem o
    # alias certo, isso tentava consultar 'dono_id' no banco local, que já
    # tinha essa coluna removida por uma migration mais nova).
    alias = schema_editor.connection.alias
    Estacao = apps.get_model('api_rest', 'Estacao')
    for estacao in Estacao.objects.using(alias).exclude(dono__isnull=True):
        estacao.usuarios.add(estacao.dono_id)


def copiar_usuarios_para_dono(apps, schema_editor):
    """Reverso: só pra permitir `migrate` andar pra trás em dev — pega
    qualquer um dos usuários vinculados como "o" dono (a distinção não
    existe mais, então não há um valor "certo" único aqui)."""
    alias = schema_editor.connection.alias
    Estacao = apps.get_model('api_rest', 'Estacao')
    for estacao in Estacao.objects.using(alias).all():
        primeiro = estacao.usuarios.using(alias).first()
        if primeiro is not None:
            estacao.dono_id = primeiro.id
            estacao.save(using=alias, update_fields=['dono_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('api_rest', '0006_estacao_usuarios_m2m'),
    ]

    operations = [
        migrations.RunPython(copiar_dono_para_usuarios, copiar_usuarios_para_dono),
    ]
