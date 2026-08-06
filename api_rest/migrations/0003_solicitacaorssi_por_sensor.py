from django.db import migrations, models


def limpar_solicitacoes_antigas(apps, schema_editor):
    """A flag antiga era global (sem sensor_id) — não faz sentido migrar
    esse estado transiente, só apagar e deixar o RX recriar por sensor."""
    SolicitacaoRssi = apps.get_model('api_rest', 'SolicitacaoRssi')
    SolicitacaoRssi.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api_rest', '0002_solicitacaorssi'),
    ]

    operations = [
        migrations.RunPython(limpar_solicitacoes_antigas, migrations.RunPython.noop),
        migrations.AddField(
            model_name='solicitacaorssi',
            name='sensor_id',
            field=models.CharField(default='', max_length=100, unique=True),
            preserve_default=False,
        ),
    ]
