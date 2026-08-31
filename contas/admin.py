from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Assinatura, Funcionalidade, LogAuditoria, Plano, TokenCredenciamento, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    """Reaproveita o UserAdmin padrão do Django (já cobre username/senha/
    permissões/grupos) e só soma os campos próprios (role, telefone,
    cpf). `credenciamento_versao` fica só no list_display (não editável
    direto no fieldset) — é estado derivado do fluxo de token, mexer nele
    à mão no admin criaria um jeito de burlar a rotação silenciosamente."""

    list_display = (
        'username', 'email', 'role', 'email_verificado', 'credenciamento_versao',
        'is_active', 'is_staff', 'date_joined',
    )
    list_filter = ('role', 'email_verificado', 'is_active', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Conta agroclimática', {'fields': ('role', 'telefone', 'cpf', 'email_verificado')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Conta agroclimática', {'fields': ('role', 'telefone', 'cpf')}),
    )


@admin.register(Funcionalidade)
class FuncionalidadeAdmin(admin.ModelAdmin):
    list_display = ('nome', 'codigo')
    search_fields = ('nome', 'codigo')


@admin.register(Plano)
class PlanoAdmin(admin.ModelAdmin):
    """`filter_horizontal` dá ao Gestor uma UI de "marcar/desmarcar" as
    Funcionalidades de cada plano — é literalmente a RN24 (reclassificar
    recursos entre planos sem alteração de código) funcionando pelo
    admin, sem precisar de nenhuma tela própria ainda."""

    list_display = ('nome', 'ordem', 'max_estacoes', 'dias_historico', 'preco_mensal', 'ativo')
    list_filter = ('ativo',)
    filter_horizontal = ('funcionalidades',)


@admin.register(Assinatura)
class AssinaturaAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'plano', 'status', 'origem', 'iniciada_em', 'encerrada_em')
    list_filter = ('status', 'origem', 'plano')
    autocomplete_fields = ('usuario',)


class TokenCredenciamentoForm(forms.ModelForm):
    """O form não expõe `token_hash` (nunca se edita um hash à mão) — só
    um campo de texto puro que o admin usa pra gerar a próxima versão."""

    novo_token = forms.CharField(
        label='Novo token', widget=forms.PasswordInput, min_length=4,
        help_text='Texto puro do novo token de credenciamento — vira hash ao salvar e não fica visível de novo.',
    )

    class Meta:
        model = TokenCredenciamento
        fields = []


@admin.register(TokenCredenciamento)
class TokenCredenciamentoAdmin(admin.ModelAdmin):
    """Rotacionar = adicionar uma versão nova (nunca editar uma
    existente — por isso change/delete ficam desligados: o histórico de
    versões é o que permite auditar quando o acesso de alguém mudou)."""

    form = TokenCredenciamentoForm
    list_display = ('versao', 'criado_em')
    ordering = ('-versao',)

    def save_model(self, request, obj, form, change):
        TokenCredenciamento.rotacionar(form.cleaned_data['novo_token'])

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LogAuditoria)
class LogAuditoriaAdmin(admin.ModelAdmin):
    """Somente leitura: um log de auditoria não deve poder ser editado ou
    apagado pela própria interface que ele audita (RN05)."""

    list_display = ('criado_em', 'ator', 'acao', 'alvo')
    list_filter = ('acao',)
    readonly_fields = [f.name for f in LogAuditoria._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
