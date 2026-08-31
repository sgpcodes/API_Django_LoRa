"""
Envio do e-mail de confirmação de cadastro. O provedor de envio de
verdade (SMTP) é configurado só via variáveis de ambiente (ver
api_root/settings.py) — sem nenhuma credencial de e-mail aqui no código.
Enquanto isso não estiver configurado, o backend de e-mail do Django cai
automaticamente no console (o conteúdo aparece no log do servidor, mas
ninguém recebe de verdade) — dá pra desenvolver e testar o fluxo inteiro
sem precisar de provedor nenhum, e passa a mandar de verdade assim que a
variável de ambiente RESEND_API_KEY existir, sem mudar nenhuma linha
de código.
"""

from django.conf import settings
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .tokens import gerador_token_verificacao_email


def _link_confirmacao(usuario):
    uidb64 = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = gerador_token_verificacao_email.make_token(usuario)
    return f'{settings.FRONTEND_URL}/confirmar-email/{uidb64}/{token}'


def enviar_email_confirmacao(usuario):
    """Chamado logo após o cadastro (CadastroView) e pelo endpoint de
    reenvio (ReenviarConfirmacaoView). Não bloqueia a criação da conta se
    falhar — só registra a falha (ver views.py) — a pessoa sempre pode
    pedir reenvio depois."""
    link = _link_confirmacao(usuario)
    send_mail(
        subject='Confirme seu e-mail — Sistema de Monitoramento Meteorológico',
        message=(
            f'Olá, {usuario.first_name or usuario.username}!\n\n'
            f'Confirme que este é o seu e-mail clicando no link abaixo:\n\n'
            f'{link}\n\n'
            f'Se você não criou essa conta, pode ignorar esta mensagem.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
        fail_silently=False,
    )
