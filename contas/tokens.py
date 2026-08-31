"""
Token de confirmação de e-mail — reaproveita o mesmo mecanismo do "esqueci
minha senha" do Django (`PasswordResetTokenGenerator`): assinado com a
SECRET_KEY, expira sozinho (`PASSWORD_RESET_TIMEOUT`) e não precisa de
tabela própria no banco (o token carrega tudo que precisa pra ser
conferido depois, sem estado guardado). É código já testado e usado em
produção por praticamente todo projeto Django — não faz sentido inventar
um mecanismo de token próprio pra isso.
"""

from django.contrib.auth.tokens import PasswordResetTokenGenerator


class GeradorTokenVerificacaoEmail(PasswordResetTokenGenerator):
    """Só muda o que entra no hash: inclui `email_verificado` (em vez do
    `password` que o gerador padrão usa) — assim, o token para de valer
    sozinho assim que a conta é confirmada (reenviar o mesmo link depois
    de já ter confirmado não faz nada de novo), sem precisar apagar nada
    do banco."""

    def _make_hash_value(self, usuario, timestamp):
        return f'{usuario.pk}{usuario.email}{usuario.email_verificado}{timestamp}'


gerador_token_verificacao_email = GeradorTokenVerificacaoEmail()
