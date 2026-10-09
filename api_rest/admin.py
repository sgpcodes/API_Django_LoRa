from django.contrib import admin

from .models import AcessoEstacao, Estacao, Leitura, SolicitacaoRssi


class AcessoEstacaoInline(admin.TabularInline):
    # Substitui o antigo `filter_horizontal = ('usuarios',)` — não dá mais
    # pra usar isso com M2M que tem through model (admin.E013). Aqui dá
    # pra ver/editar direto quais variáveis cada conta vinculada enxerga.
    model = AcessoEstacao
    extra = 0


@admin.register(Estacao)
class EstacaoAdmin(admin.ModelAdmin):
    list_display = ('identificador', 'nome', 'usuarios_display', 'esta_offline_display', 'ultima_transmissao_em', 'ativa')
    list_filter = ('ativa', 'intervalo_envio_minutos')
    search_fields = ('identificador', 'nome')
    inlines = [AcessoEstacaoInline]
    readonly_fields = ('ultima_transmissao_em', 'criado_em', 'token_hash')
    actions = ['gerar_novo_token']

    @admin.display(description='Usuários')
    def usuarios_display(self, obj):
        return ', '.join(obj.usuarios.values_list('username', flat=True)) or '—'

    @admin.display(boolean=True, description='Offline')
    def esta_offline_display(self, obj):
        return obj.esta_offline

    @admin.action(description='Gerar novo token de API para as estações selecionadas')
    def gerar_novo_token(self, request, queryset):
        """O token em texto puro só existe neste momento — é mostrado uma
        única vez na mensagem do admin, nunca fica recuperável depois
        (só o hash é salvo, ver Estacao.gerar_token)."""
        for estacao in queryset:
            token = estacao.gerar_token()
            self.message_user(request, f'{estacao.identificador}: novo token = {token}')


@admin.register(Leitura)
class LeituraAdmin(admin.ModelAdmin):
    list_display = ('sensor_id', 'estacao', 'temperatura', 'umidade', 'pressao', 'data_hora', 'inconsistente')
    list_filter = ('inconsistente', 'estacao')
    search_fields = ('sensor_id',)
    date_hierarchy = 'data_hora'


@admin.register(SolicitacaoRssi)
class SolicitacaoRssiAdmin(admin.ModelAdmin):
    list_display = ('sensor_id', 'estacao', 'pendente', 'atualizado_em')
    list_filter = ('pendente',)
