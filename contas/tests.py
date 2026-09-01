"""
Testes do app `contas`: login (JWT), permissões de Gestor vs Usuário
comum sobre contas, e o fluxo de troca de plano (Assinatura).
"""

from rest_framework import status
from rest_framework.test import APITestCase

from .models import Assinatura, Funcionalidade, LogAuditoria, Plano, TokenCredenciamento, Usuario

# Semeado pela migration contas.0004_seed_token_credenciamento — presente
# no banco de teste porque as migrations rodam por completo antes da suíte.
TOKEN_SEMEADO = 'Lacop22'


# Nomes com sufixo "-teste": a migration 0002_seed_planos já cria planos
# reais chamados "Standard"/"Pro"/"Plus" (nome é unique=True) — usar esses
# nomes aqui colidiria com o dado semeado, que também está presente no
# banco de teste (migrations rodam por completo antes da suíte).
def criar_plano(nome='Standard-teste', **kwargs):
    kwargs.setdefault('dias_historico', 30)
    return Plano.objects.create(nome=nome, **kwargs)


class LoginJwtTests(APITestCase):
    """RN20: Gestor e Usuário se autenticam por login e senha, recebendo
    um token JWT — RN: só depois do e-mail confirmado."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username='produtor1', password='senha-forte-123', role=Usuario.Role.USUARIO,
            email_verificado=True,
        )

    def test_login_com_credenciais_corretas_devolve_tokens_com_role(self):
        resposta = self.client.post('/api/auth/token/', {
            'username': 'produtor1', 'password': 'senha-forte-123',
        })
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)

    def test_login_com_senha_errada_e_rejeitado(self):
        resposta = self.client.post('/api/auth/token/', {
            'username': 'produtor1', 'password': 'senha-errada',
        })
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_endpoint_protegido_sem_token_e_rejeitado(self):
        resposta = self.client.get('/api/usuarios/')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_sem_email_confirmado_e_bloqueado(self):
        Usuario.objects.create_user(username='pendente1', password='x', email_verificado=False)
        resposta = self.client.post('/api/auth/token/', {'username': 'pendente1', 'password': 'x'})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resposta.data.get('codigo'), ['''email_nao_confirmado'''])

    def test_superusuario_loga_mesmo_sem_email_confirmado(self):
        """createsuperuser não passa pelo cadastro público — não faz
        sentido travar por e-mail um acesso já de confiança (shell do
        servidor)."""
        Usuario.objects.create_superuser(username='root1', password='x', email_verificado=False)
        resposta = self.client.post('/api/auth/token/', {'username': 'root1', 'password': 'x'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)


class UsuarioViewSetTests(APITestCase):
    """RN01/RN02 (Gestor tem acesso irrestrito e administra contas) vs.
    RN07/RN08 (Usuário só vê/edita a própria conta)."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(
            username='gestor1', password='x', role=Usuario.Role.GESTOR,
        )
        self.usuario1 = Usuario.objects.create_user(
            username='usuario1', password='x', role=Usuario.Role.USUARIO,
        )
        self.usuario2 = Usuario.objects.create_user(
            username='usuario2', password='x', role=Usuario.Role.USUARIO,
        )

    def test_usuario_comum_nao_pode_listar_contas(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get('/api/usuarios/')
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_pode_listar_todas_as_contas(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.get('/api/usuarios/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        usernames = {u['username'] for u in resposta.data}
        self.assertEqual(usernames, {'gestor1', 'usuario1', 'usuario2'})

    def test_usuario_comum_nao_ve_dados_de_outro_usuario(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get(f'/api/usuarios/{self.usuario2.pk}/')
        # Fora do queryset dele -> 404, não 403 (não revela nem que a conta existe)
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_usuario_comum_ve_a_propria_conta_pelo_endpoint_me(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get('/api/usuarios/me/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['username'], 'usuario1')

    def test_gestor_tambem_ve_a_propria_conta_pelo_endpoint_me(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.get('/api/usuarios/me/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['username'], 'gestor1')

    def test_usuario_comum_edita_a_propria_conta(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.patch(f'/api/usuarios/{self.usuario1.pk}/', {'telefone': '21999999999'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario1.refresh_from_db()
        self.assertEqual(self.usuario1.telefone, '21999999999')

    def test_usuario_comum_troca_a_propria_senha_informando_a_atual(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.patch(
            f'/api/usuarios/{self.usuario1.pk}/', {'senha_atual': 'x', 'password': 'senha-nova-123'},
        )
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario1.refresh_from_db()
        self.assertTrue(self.usuario1.check_password('senha-nova-123'))

    def test_usuario_comum_nao_troca_senha_com_senha_atual_errada(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.patch(
            f'/api/usuarios/{self.usuario1.pk}/', {'senha_atual': 'errada', 'password': 'senha-nova-123'},
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.usuario1.refresh_from_db()
        self.assertTrue(self.usuario1.check_password('x'))

    def test_gestor_redefine_senha_de_outra_conta_sem_precisar_da_senha_atual_dela(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.patch(f'/api/usuarios/{self.usuario1.pk}/', {'password': 'senha-nova-123'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario1.refresh_from_db()
        self.assertTrue(self.usuario1.check_password('senha-nova-123'))

    def test_usuario_comum_nao_consegue_virar_gestor_sozinho(self):
        """RN19 (menor privilégio): tentar se autopromover via payload é
        ignorado — o campo `role` só é aceito se quem edita for Gestor."""
        self.client.force_authenticate(self.usuario1)
        self.client.patch(f'/api/usuarios/{self.usuario1.pk}/', {'role': Usuario.Role.GESTOR})
        self.usuario1.refresh_from_db()
        self.assertEqual(self.usuario1.role, Usuario.Role.USUARIO)

    def test_usuario_comum_nao_pode_criar_conta(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.post('/api/usuarios/', {'username': 'novo', 'password': 'senha12345'})
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_pode_criar_conta(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.post('/api/usuarios/', {'username': 'novo', 'password': 'senha12345'})
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Usuario.objects.filter(username='novo').exists())

    def test_gestor_pode_suspender_conta_e_isso_vai_para_auditoria(self):
        """RN02 + RN05."""
        self.client.force_authenticate(self.gestor)
        resposta = self.client.post(f'/api/usuarios/{self.usuario1.pk}/suspender/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.usuario1.refresh_from_db()
        self.assertFalse(self.usuario1.is_active)
        self.assertTrue(LogAuditoria.objects.filter(acao='usuario.suspenso', ator=self.gestor).exists())

    def test_usuario_comum_nao_pode_suspender_outra_conta(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.post(f'/api/usuarios/{self.usuario2.pk}/suspender/')
        self.assertIn(resposta.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        self.usuario2.refresh_from_db()
        self.assertTrue(self.usuario2.is_active)


class AssinaturaTrocaPlanoTests(APITestCase):
    """RN25 (histórico de troca de plano) e RN26 (não permitir assinar de
    novo o plano já ativo)."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user(username='produtor1', password='x')
        self.outro_usuario = Usuario.objects.create_user(username='produtor2', password='x')
        self.gestor = Usuario.objects.create_user(username='gestor1', password='x', role=Usuario.Role.GESTOR)
        self.standard = criar_plano('Standard-teste', ordem=0, dias_historico=30)
        self.pro = criar_plano('Pro-teste', ordem=1, dias_historico=365)

    def test_primeira_assinatura(self):
        self.client.force_authenticate(self.usuario)
        resposta = self.client.post('/api/assinaturas/trocar_plano/', {'plano': self.standard.pk})
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Assinatura.objects.filter(usuario=self.usuario, encerrada_em__isnull=True).count(), 1,
        )

    def test_upgrade_encerra_assinatura_anterior_e_mantem_historico(self):
        self.client.force_authenticate(self.usuario)
        self.client.post('/api/assinaturas/trocar_plano/', {'plano': self.standard.pk})
        self.client.post('/api/assinaturas/trocar_plano/', {'plano': self.pro.pk})

        ativas = Assinatura.objects.filter(usuario=self.usuario, encerrada_em__isnull=True)
        self.assertEqual(ativas.count(), 1)
        self.assertEqual(ativas.first().plano, self.pro)
        # a assinatura antiga continua no histórico, só não está mais ativa
        self.assertEqual(Assinatura.objects.filter(usuario=self.usuario).count(), 2)
        antiga = Assinatura.objects.filter(usuario=self.usuario, plano=self.standard).first()
        self.assertIsNotNone(antiga.encerrada_em)

    def test_nao_permite_assinar_o_mesmo_plano_ja_ativo(self):
        self.client.force_authenticate(self.usuario)
        self.client.post('/api/assinaturas/trocar_plano/', {'plano': self.standard.pk})
        resposta = self.client.post('/api/assinaturas/trocar_plano/', {'plano': self.standard.pk})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usuario_comum_nao_pode_trocar_plano_de_outra_conta(self):
        self.client.force_authenticate(self.usuario)
        resposta = self.client.post(
            '/api/assinaturas/trocar_plano/', {'plano': self.pro.pk, 'usuario': self.outro_usuario.pk},
        )
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_pode_trocar_plano_de_qualquer_conta_e_isso_vai_para_auditoria(self):
        """RN03 + RN05."""
        self.client.force_authenticate(self.gestor)
        resposta = self.client.post(
            '/api/assinaturas/trocar_plano/', {'plano': self.pro.pk, 'usuario': self.usuario.pk},
        )
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        nova = Assinatura.objects.get(usuario=self.usuario, encerrada_em__isnull=True)
        self.assertEqual(nova.origem, Assinatura.Origem.GESTOR)
        self.assertTrue(LogAuditoria.objects.filter(acao='plano.alterado', ator=self.gestor).exists())

    def test_constraint_impede_duas_assinaturas_ativas_no_banco(self):
        """Checagem no nível do banco (UniqueConstraint), não só na view —
        garante que mesmo um bug futuro na view não corrompa o dado."""
        Assinatura.objects.create(usuario=self.usuario, plano=self.standard)
        from django.db import IntegrityError, transaction
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Assinatura.objects.create(usuario=self.usuario, plano=self.pro)


class PlanoFuncionalidadeViewSetTests(APITestCase):
    """RN24: só o Gestor reclassifica funcionalidades entre planos."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(username='gestor1', password='x', role=Usuario.Role.GESTOR)
        self.usuario = Usuario.objects.create_user(username='usuario1', password='x')
        self.plano = criar_plano()

    def test_qualquer_autenticado_pode_listar_planos(self):
        self.client.force_authenticate(self.usuario)
        resposta = self.client.get('/api/planos/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_usuario_comum_nao_pode_criar_plano(self):
        self.client.force_authenticate(self.usuario)
        resposta = self.client.post('/api/planos/', {'nome': 'Hacker', 'dias_historico': 9999})
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_pode_reclassificar_funcionalidade_de_plano(self):
        funcionalidade = Funcionalidade.objects.create(codigo='x', nome='X')
        self.client.force_authenticate(self.gestor)
        resposta = self.client.patch(f'/api/planos/{self.plano.pk}/', {'funcionalidades': [funcionalidade.pk]})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn(funcionalidade, self.plano.funcionalidades.all())


class PlanosPublicosTests(APITestCase):
    """A vitrine de planos (tela de cadastro) precisa listar sem login."""

    def test_lista_planos_sem_autenticacao(self):
        resposta = self.client.get('/api/planos/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)


class CadastroPublicoTests(APITestCase):
    """POST /api/auth/cadastro/ — sem login, dois caminhos: plano (vira
    Usuário) ou token de credenciamento (vira Gestor)."""

    def setUp(self):
        self.plano = criar_plano('Standard-cadastro')
        self.outro_plano = criar_plano('Pro-cadastro', ordem=1, dias_historico=365)

    def _payload(self, **extra):
        base = {
            'email': 'nova@exemplo.com',
            'nome_completo': 'Nova Produtora',
            'cpf': '111.444.777-35',  # CPF válido (dígitos verificadores corretos), usado só em teste
            'password': 'senha-forte-123',
            'confirmar_senha': 'senha-forte-123',
        }
        base.update(extra)
        return base

    def test_cadastro_com_plano_cria_usuario_comum_com_assinatura(self):
        resposta = self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        # RN: cadastro não loga mais automaticamente — só completa com o
        # e-mail confirmado (ver ConfirmarEmailTests).
        self.assertNotIn('access', resposta.data)
        self.assertEqual(resposta.data.get('status'), 'pending_email_confirmation')

        usuario = Usuario.objects.get(email='nova@exemplo.com')
        self.assertEqual(usuario.username, 'nova@exemplo.com')  # e-mail também é o username
        self.assertEqual(usuario.role, Usuario.Role.USUARIO)
        self.assertFalse(usuario.email_verificado)
        self.assertTrue(usuario.check_password('senha-forte-123'))
        self.assertTrue(Assinatura.objects.filter(usuario=usuario, plano=self.plano, encerrada_em__isnull=True).exists())

    def test_cadastro_nao_permite_login_antes_de_confirmar(self):
        self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        resposta = self.client.post(
            '/api/auth/token/', {'username': 'nova@exemplo.com', 'password': 'senha-forte-123'},
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resposta.data.get('codigo'), ['''email_nao_confirmado'''])

    def test_cadastro_depois_confirmar_email_login_funciona(self):
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        from .tokens import gerador_token_verificacao_email

        self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        usuario = Usuario.objects.get(email='nova@exemplo.com')

        uidb64 = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = gerador_token_verificacao_email.make_token(usuario)
        self.client.post('/api/auth/confirmar-email/', {'uidb64': uidb64, 'token': token})

        resposta = self.client.post(
            '/api/auth/token/', {'username': 'nova@exemplo.com', 'password': 'senha-forte-123'},
        )
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)

    def test_cadastro_credenciado_com_token_certo_vira_gestor_sem_assinatura(self):
        resposta = self.client.post('/api/auth/cadastro/', self._payload(token_credenciamento=TOKEN_SEMEADO))
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

        usuario = Usuario.objects.get(email='nova@exemplo.com')
        self.assertEqual(usuario.role, Usuario.Role.GESTOR)
        self.assertEqual(usuario.credenciamento_versao, 1)
        self.assertTrue(usuario.eh_gestor)
        self.assertFalse(Assinatura.objects.filter(usuario=usuario).exists())

    def test_cadastro_credenciado_loga_mesmo_sem_confirmar_email(self):
        # Exceção temporária (ver TokenObtainPairComRoleSerializer.validate):
        # sem domínio verificado no Resend, o e-mail de confirmação só
        # chega pro dono da conta Resend — bloquear Gestor deixaria
        # qualquer outra pessoa credenciada sem conseguir entrar.
        self.client.post('/api/auth/cadastro/', self._payload(token_credenciamento=TOKEN_SEMEADO))
        usuario = Usuario.objects.get(email='nova@exemplo.com')
        self.assertFalse(usuario.email_verificado)

        resposta = self.client.post(
            '/api/auth/token/', {'username': 'nova@exemplo.com', 'password': 'senha-forte-123'},
        )
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)

    def test_cadastro_com_token_errado_e_rejeitado(self):
        resposta = self.client.post('/api/auth/cadastro/', self._payload(token_credenciamento='token-errado'))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Usuario.objects.filter(email='nova@exemplo.com').exists())

    def test_cadastro_sem_plano_e_sem_token_e_rejeitado(self):
        resposta = self.client.post('/api/auth/cadastro/', self._payload())
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_senhas_diferentes_sao_rejeitadas(self):
        resposta = self.client.post(
            '/api/auth/cadastro/', self._payload(plano=self.plano.pk, confirmar_senha='outra-senha'),
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_duplicado_e_rejeitado(self):
        Usuario.objects.create_user(username='nova@exemplo.com', email='nova@exemplo.com', password='x')
        resposta = self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cpf_invalido_e_rejeitado(self):
        """RN: CPF precisa ser real (dígito verificador conferido), não só
        11 números quaisquer."""
        resposta = self.client.post(
            '/api/auth/cadastro/', self._payload(plano=self.plano.pk, cpf='123.456.789-00'),
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cpf', resposta.data)
        self.assertFalse(Usuario.objects.filter(email='nova@exemplo.com').exists())

    def test_cpf_com_todos_digitos_iguais_e_rejeitado(self):
        resposta = self.client.post(
            '/api/auth/cadastro/', self._payload(plano=self.plano.pk, cpf='111.111.111-11'),
        )
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cpf_sem_informar_e_rejeitado(self):
        """Agora é obrigatório — antes era opcional."""
        payload = self._payload(plano=self.plano.pk)
        del payload['cpf']
        resposta = self.client.post('/api/auth/cadastro/', payload)
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cpf_duplicado_e_rejeitado(self):
        self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        resposta = self.client.post('/api/auth/cadastro/', self._payload(
            email='outra@exemplo.com', plano=self.plano.pk, cpf='111.444.777-35',  # mesmo CPF, e-mail diferente
        ))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Usuario.objects.filter(email='outra@exemplo.com').exists())

    def test_cpf_duplicado_e_rejeitado_mesmo_em_plano_diferente(self):
        """Não é "um CPF por plano específico" — é um CPF por TIPO de
        conta (Usuário, não importa qual plano). Tentar de novo com o
        Pro em vez do Standard continua batendo no mesmo CPF já usado."""
        self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        resposta = self.client.post('/api/auth/cadastro/', self._payload(
            email='outra-plano-diferente@exemplo.com', plano=self.outro_plano.pk,
        ))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Usuario.objects.filter(email='outra-plano-diferente@exemplo.com').exists())

    def test_mesmo_cpf_pode_ter_conta_usuario_e_conta_gestor(self):
        """RN: "PF/PJ no mesmo banco" — a mesma pessoa pode ter uma conta
        Usuário (com plano) e uma conta Gestor (credenciada) com o mesmo
        CPF, uma de cada tipo."""
        resposta_usuario = self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        self.assertEqual(resposta_usuario.status_code, status.HTTP_201_CREATED)

        resposta_gestor = self.client.post('/api/auth/cadastro/', self._payload(
            email='mesma-pessoa-gestora@exemplo.com', token_credenciamento=TOKEN_SEMEADO,
        ))
        self.assertEqual(resposta_gestor.status_code, status.HTTP_201_CREATED)

        self.assertEqual(Usuario.objects.filter(cpf='11144477735').count(), 2)

    def test_cpf_duplicado_no_mesmo_papel_gestor_e_rejeitado(self):
        self.client.post('/api/auth/cadastro/', self._payload(token_credenciamento=TOKEN_SEMEADO))
        resposta = self.client.post('/api/auth/cadastro/', self._payload(
            email='outra-gestora@exemplo.com', token_credenciamento=TOKEN_SEMEADO,
        ))
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Usuario.objects.filter(email='outra-gestora@exemplo.com').exists())

    def test_cpf_e_salvo_so_com_digitos(self):
        """A formatação (pontos/traço) não é guardada — só os 11 dígitos,
        pra "111.444.777-35" e "11144477735" serem reconhecidos como o
        mesmo CPF na checagem de duplicidade."""
        self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        usuario = Usuario.objects.get(email='nova@exemplo.com')
        self.assertEqual(usuario.cpf, '11144477735')

    def test_cadastro_dispara_email_de_confirmacao(self):
        from django.core import mail

        resposta = self.client.post('/api/auth/cadastro/', self._payload(plano=self.plano.pk))
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['nova@exemplo.com'])
        self.assertIn('/confirmar-email/', mail.outbox[0].body)

        usuario = Usuario.objects.get(email='nova@exemplo.com')
        self.assertFalse(usuario.email_verificado)


class ConfirmarEmailTests(APITestCase):
    """POST /api/auth/confirmar-email/ (link do e-mail) e
    POST /api/auth/reenviar-confirmacao/ (logado, pede de novo)."""

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username='pendente@exemplo.com', email='pendente@exemplo.com', password='x',
        )
        self.assertFalse(self.usuario.email_verificado)

    def _link_valido(self):
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode

        from .tokens import gerador_token_verificacao_email

        uidb64 = urlsafe_base64_encode(force_bytes(self.usuario.pk))
        token = gerador_token_verificacao_email.make_token(self.usuario)
        return uidb64, token

    def test_confirmar_com_token_valido_marca_email_verificado(self):
        uidb64, token = self._link_valido()
        resposta = self.client.post('/api/auth/confirmar-email/', {'uidb64': uidb64, 'token': token})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.email_verificado)

    def test_confirmar_com_token_invalido_e_rejeitado(self):
        uidb64, _ = self._link_valido()
        resposta = self.client.post('/api/auth/confirmar-email/', {'uidb64': uidb64, 'token': 'token-chutado'})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.email_verificado)

    def test_confirmar_com_uid_invalido_e_rejeitado(self):
        resposta = self.client.post('/api/auth/confirmar-email/', {'uidb64': 'lixo-nao-base64!!', 'token': 'x'})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_nao_funciona_de_novo_depois_de_confirmado(self):
        """O hash do token inclui `email_verificado` — depois de confirmar,
        o mesmo link antigo (ex.: clicado duas vezes, ou reenviado por
        engano) não faz nada de novo, mas também não quebra nada."""
        uidb64, token = self._link_valido()
        primeira = self.client.post('/api/auth/confirmar-email/', {'uidb64': uidb64, 'token': token})
        self.assertEqual(primeira.status_code, status.HTTP_200_OK)

        segunda = self.client.post('/api/auth/confirmar-email/', {'uidb64': uidb64, 'token': token})
        self.assertEqual(segunda.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reenviar_confirmacao_manda_novo_email(self):
        from django.core import mail

        self.client.force_authenticate(self.usuario)
        resposta = self.client.post('/api/auth/reenviar-confirmacao/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['pendente@exemplo.com'])

    def test_reenviar_confirmacao_exige_login(self):
        resposta = self.client.post('/api/auth/reenviar-confirmacao/')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reenviar_confirmacao_quando_ja_verificado_e_rejeitado(self):
        self.usuario.email_verificado = True
        self.usuario.save(update_fields=['email_verificado'])

        self.client.force_authenticate(self.usuario)
        resposta = self.client.post('/api/auth/reenviar-confirmacao/')
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reenviar_confirmacao_publico_sem_login_manda_email(self):
        """É essa que sobra pra quem tá travado sem conseguir logar."""
        from django.core import mail

        resposta = self.client.post('/api/auth/reenviar-confirmacao-publico/', {'email': 'pendente@exemplo.com'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_reenviar_confirmacao_publico_nao_revela_se_email_existe(self):
        """Mesma resposta genérica pra e-mail cadastrado (mas já
        confirmado) e pra e-mail que nunca existiu — não dá pra usar isso
        como forma de descobrir quem tem conta aqui."""
        self.usuario.email_verificado = True
        self.usuario.save(update_fields=['email_verificado'])

        resposta_ja_confirmado = self.client.post(
            '/api/auth/reenviar-confirmacao-publico/', {'email': 'pendente@exemplo.com'},
        )
        resposta_inexistente = self.client.post(
            '/api/auth/reenviar-confirmacao-publico/', {'email': 'nunca-existiu@exemplo.com'},
        )
        self.assertEqual(resposta_ja_confirmado.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta_inexistente.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta_ja_confirmado.data, resposta_inexistente.data)


class RecredenciamentoTests(APITestCase):
    """Rotacionar o token derruba o efeito de Gestor de quem foi
    credenciado pelo caminho público, até recredenciar com o token novo —
    mas não afeta quem foi promovido por outro meio (credenciamento_versao
    None)."""

    def setUp(self):
        self.usuario_credenciado = Usuario.objects.create_user(
            username='credenciado@exemplo.com', password='x', email_verificado=True,
            role=Usuario.Role.GESTOR, credenciamento_versao=1,
        )
        self.usuario_promovido_por_admin = Usuario.objects.create_user(
            username='promovido@exemplo.com', password='x',
            role=Usuario.Role.GESTOR,  # credenciamento_versao fica None (padrão)
        )

    def test_antes_de_rotacionar_ambos_sao_gestor(self):
        self.assertTrue(self.usuario_credenciado.eh_gestor)
        self.assertTrue(self.usuario_promovido_por_admin.eh_gestor)

    def test_rotacionar_token_derruba_so_quem_veio_do_credenciamento_publico(self):
        TokenCredenciamento.rotacionar('Lacop23')

        self.usuario_credenciado.refresh_from_db()
        self.usuario_promovido_por_admin.refresh_from_db()

        self.assertFalse(self.usuario_credenciado.eh_gestor)
        self.assertTrue(self.usuario_credenciado.precisa_recredenciar)

        self.assertTrue(self.usuario_promovido_por_admin.eh_gestor)
        self.assertFalse(self.usuario_promovido_por_admin.precisa_recredenciar)

    def test_login_apos_rotacao_indica_precisa_recredenciar(self):
        TokenCredenciamento.rotacionar('Lacop23')
        resposta = self.client.post('/api/auth/token/', {'username': 'credenciado@exemplo.com', 'password': 'x'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        # O claim vai dentro do JWT (não no corpo da resposta) — só confirma
        # que o login em si continua funcionando mesmo com acesso suspenso.
        self.assertIn('access', resposta.data)

    def test_recredenciar_com_token_novo_restaura_acesso(self):
        TokenCredenciamento.rotacionar('Lacop23')
        self.client.force_authenticate(self.usuario_credenciado)

        resposta = self.client.post('/api/auth/recredenciar/', {'token': 'Lacop23'})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

        self.usuario_credenciado.refresh_from_db()
        self.assertTrue(self.usuario_credenciado.eh_gestor)
        self.assertEqual(self.usuario_credenciado.credenciamento_versao, 2)

    def test_recredenciar_com_token_errado_nao_muda_nada(self):
        TokenCredenciamento.rotacionar('Lacop23')
        self.client.force_authenticate(self.usuario_credenciado)

        resposta = self.client.post('/api/auth/recredenciar/', {'token': 'token-chutado'})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

        self.usuario_credenciado.refresh_from_db()
        self.assertFalse(self.usuario_credenciado.eh_gestor)

    def test_usuario_comum_pode_se_credenciar_pela_primeira_vez(self):
        usuario_comum = Usuario.objects.create_user(username='comum@exemplo.com', password='x')
        self.client.force_authenticate(usuario_comum)

        resposta = self.client.post('/api/auth/recredenciar/', {'token': TOKEN_SEMEADO})
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

        usuario_comum.refresh_from_db()
        self.assertTrue(usuario_comum.eh_gestor)
        self.assertEqual(usuario_comum.role, Usuario.Role.GESTOR)

    def test_versoes_antigas_do_token_nao_valem_mais(self):
        TokenCredenciamento.rotacionar('Lacop23')
        self.client.force_authenticate(self.usuario_credenciado)

        resposta = self.client.post('/api/auth/recredenciar/', {'token': TOKEN_SEMEADO})  # token v1, já superado
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
