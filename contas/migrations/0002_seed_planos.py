# Semeia o catálogo inicial de Funcionalidades e os três Planos descritos
# na Seção 4 do documento de regras de negócio (RN21-RN23, Figura 3).
#
# Valores como `max_estacoes`, `dias_historico` e `canais_alerta` de cada
# plano são placeholders razoáveis onde o documento não foi 100% explícito
# (ex.: o documento não diz o limite de estações do Standard, só que o
# Pro tem "até 5" e o Plus é ilimitado — assumimos Standard=1, o
# entry-level de único dispositivo). Ajuste pelo Django Admin a qualquer
# momento (RN24) — nenhum valor aqui é hardcoded no código da aplicação,
# só nesta semente inicial.

from django.db import migrations


FUNCIONALIDADES = [
    ('previsao_chuva_24_48h', 'Previsão de chuva (24-48h)'),
    ('indice_geada_estresse_termico', 'Índice de geada / estresse térmico'),
    ('irrigacao_evapotranspiracao', 'Recomendação de irrigação (evapotranspiração)'),
    ('previsao_medio_prazo', 'Previsão de médio prazo (7-15 dias)'),
    ('modelos_machine_learning', 'Modelos de Machine Learning'),
    ('alertas_personalizados_ia', 'Alertas personalizados via IA'),
    ('api_integracao', 'API própria de integração'),
    ('suporte_prioritario', 'Suporte prioritário'),
]

# Cada plano é cumulativo: Pro repete tudo que compõe o Standard (nada,
# já que Standard não tem modelo preditivo) e soma o próprio; Plus repete
# o que compõe o Pro e soma o próprio — reflete a "estrutura cumulativa"
# da Figura 3.
PLANOS = [
    {
        'nome': 'Standard', 'ordem': 0, 'max_estacoes': 1, 'dias_historico': 30,
        'canais_alerta': ['email', 'dashboard'], 'funcionalidades': [],
    },
    {
        'nome': 'Pro', 'ordem': 1, 'max_estacoes': 5, 'dias_historico': 365,
        'canais_alerta': ['email', 'dashboard', 'telefone'],
        'funcionalidades': [
            'previsao_chuva_24_48h', 'indice_geada_estresse_termico', 'irrigacao_evapotranspiracao',
        ],
    },
    {
        'nome': 'Plus', 'ordem': 2, 'max_estacoes': None, 'dias_historico': 365,
        'canais_alerta': ['email', 'dashboard', 'telefone'],
        'funcionalidades': [
            'previsao_chuva_24_48h', 'indice_geada_estresse_termico', 'irrigacao_evapotranspiracao',
            'previsao_medio_prazo', 'modelos_machine_learning', 'alertas_personalizados_ia',
            'api_integracao', 'suporte_prioritario',
        ],
    },
]


def semear(apps, schema_editor):
    Funcionalidade = apps.get_model('contas', 'Funcionalidade')
    Plano = apps.get_model('contas', 'Plano')

    codigo_para_funcionalidade = {}
    for codigo, nome in FUNCIONALIDADES:
        funcionalidade, _ = Funcionalidade.objects.get_or_create(codigo=codigo, defaults={'nome': nome})
        codigo_para_funcionalidade[codigo] = funcionalidade

    for dados_plano_original in PLANOS:
        # Copia antes de popar 'funcionalidades' — PLANOS é um módulo global,
        # mutá-lo direto quebraria uma segunda execução desta função no
        # mesmo processo (ex.: suíte de testes recriando o banco).
        dados_plano = dict(dados_plano_original)
        codigos = dados_plano.pop('funcionalidades')
        plano, _ = Plano.objects.get_or_create(nome=dados_plano['nome'], defaults=dados_plano)
        plano.funcionalidades.set(codigo_para_funcionalidade[codigo] for codigo in codigos)


def reverter(apps, schema_editor):
    Plano = apps.get_model('contas', 'Plano')
    Funcionalidade = apps.get_model('contas', 'Funcionalidade')
    Plano.objects.filter(nome__in=[p['nome'] for p in PLANOS]).delete()
    Funcionalidade.objects.filter(codigo__in=[codigo for codigo, _ in FUNCIONALIDADES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('contas', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(semear, reverter),
    ]
