"""
Testes do app `api_rest`: ingestão de leituras (que deve continuar aberta
para o ESP32, RN14 fase futura), isolamento de dados por dono de estação
(RN06/RN07), sinalização de inconsistência (RN18) e limite de estações
por plano (RN10).
"""

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from contas.models import Assinatura, Funcionalidade, Plano, Usuario

from .models import Estacao, Leitura, SolicitacaoRssi
from .permissions import RecursoDoPlano


def criar_estacao(identificador, *usuarios):
    """Cria uma Estacao já com as contas informadas vinculadas — helper
    de teste porque `usuarios` é M2M (não dá pra passar como kwarg no
    `.create()`, precisa da estação já ter PK antes de vincular)."""
    estacao = Estacao.objects.create(identificador=identificador)
    if usuarios:
        estacao.usuarios.set(usuarios)
    return estacao


class IngestaoLeituraTests(APITestCase):
    """A view de ingestão (POST) é chamada pelo hardware, sem login — não
    pode passar a exigir autenticação nesta fase (o firmware não muda)."""

    def test_post_sem_autenticacao_funciona(self):
        resposta = self.client.post('/api/leituras', {
            'sensor': 'ESP32_99', 'temperatura': 25.3, 'umidade': 60.0,
        })
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Leitura.objects.filter(sensor_id='ESP32_99').exists())

    def test_leitura_sem_estacao_cadastrada_e_salva_mesmo_assim(self):
        """Compatibilidade: nenhuma Estacao precisa existir ainda para o
        POST do dispositivo funcionar — comportamento idêntico ao de
        antes desta mudança."""
        resposta = self.client.post('/api/leituras', {
            'sensor': 'SENSOR_NUNCA_CADASTRADO', 'temperatura': 20, 'umidade': 50,
        })
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        leitura = Leitura.objects.get(sensor_id='SENSOR_NUNCA_CADASTRADO')
        self.assertIsNone(leitura.estacao)

    def test_leitura_liga_a_estacao_existente_e_atualiza_ultima_transmissao(self):
        dono = Usuario.objects.create_user(username='dono1', password='x')
        estacao = criar_estacao('ESP32_01', dono)
        self.assertIsNone(estacao.ultima_transmissao_em)

        resposta = self.client.post('/api/leituras', {
            'sensor': 'ESP32_01', 'temperatura': 22.0, 'umidade': 55.0,
        })
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

        leitura = Leitura.objects.get(sensor_id='ESP32_01')
        self.assertEqual(leitura.estacao, estacao)
        estacao.refresh_from_db()
        self.assertIsNotNone(estacao.ultima_transmissao_em)

    def test_umidade_fora_da_faixa_marca_leitura_como_inconsistente_mas_salva(self):
        """RN18: sinalizada, não rejeitada."""
        resposta = self.client.post('/api/leituras', {
            'sensor': 'ESP32_02', 'temperatura': 21.0, 'umidade': 150.0,
        })
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        leitura = Leitura.objects.get(sensor_id='ESP32_02')
        self.assertTrue(leitura.inconsistente)
        self.assertIn('umidade', leitura.motivo_inconsistencia)

    def test_leitura_dentro_da_faixa_nao_e_marcada(self):
        resposta = self.client.post('/api/leituras', {
            'sensor': 'ESP32_03', 'temperatura': 24.0, 'umidade': 70.0,
        })
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        leitura = Leitura.objects.get(sensor_id='ESP32_03')
        self.assertFalse(leitura.inconsistente)


class LeituraIsolamentoTests(APITestCase):
    """RN06/RN07: Usuário só vê leituras das estações vinculadas a ele;
    Gestor vê tudo (RN01)."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(username='gestor1', password='x', role=Usuario.Role.GESTOR)
        self.usuario1 = Usuario.objects.create_user(username='usuario1', password='x')
        self.usuario2 = Usuario.objects.create_user(username='usuario2', password='x')

        self.estacao1 = criar_estacao('EST_1', self.usuario1)
        self.estacao2 = criar_estacao('EST_2', self.usuario2)

        agora = timezone.now()
        self.leitura1 = Leitura.objects.create(
            sensor_id='EST_1', estacao=self.estacao1, temperatura=20, umidade=50, data_hora=agora,
        )
        self.leitura2 = Leitura.objects.create(
            sensor_id='EST_2', estacao=self.estacao2, temperatura=22, umidade=55, data_hora=agora,
        )

    def test_get_leituras_sem_autenticacao_e_rejeitado(self):
        resposta = self.client.get('/api/leituras/')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_usuario_comum_so_ve_leituras_da_propria_estacao(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get('/api/leituras/')
        sensores = {item['sensor_id'] for item in resposta.data}
        self.assertEqual(sensores, {'EST_1'})

    def test_gestor_ve_leituras_de_todas_as_estacoes(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.get('/api/leituras/')
        sensores = {item['sensor_id'] for item in resposta.data}
        self.assertEqual(sensores, {'EST_1', 'EST_2'})

    def test_usuario_comum_nao_acessa_detalhe_de_leitura_de_outra_estacao(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get(f'/api/leituras/{self.leitura2.pk}/')
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_usuario_comum_acessa_detalhe_da_propria_leitura(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get(f'/api/leituras/{self.leitura1.pk}/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)


class RssiSolicitarTests(APITestCase):
    """RN07: usuário só pode pedir análise de RSSI de estação vinculada a
    ele; o endpoint de status (consultado pelo hardware) continua aberto."""

    def setUp(self):
        self.usuario1 = Usuario.objects.create_user(username='usuario1', password='x')
        self.usuario2 = Usuario.objects.create_user(username='usuario2', password='x')
        self.estacao1 = criar_estacao('EST_1', self.usuario1)

    def test_status_continua_aberto_para_o_hardware(self):
        resposta = self.client.get('/api/rssi/status/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_solicitar_sem_autenticacao_e_rejeitado(self):
        resposta = self.client.post('/api/rssi/solicitar/', {'sensor_id': 'EST_1'})
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_dono_pode_solicitar_analise_da_propria_estacao(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.post('/api/rssi/solicitar/', {'sensor_id': 'EST_1'})
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SolicitacaoRssi.objects.get(sensor_id='EST_1').pendente)

    def test_usuario_nao_pode_solicitar_analise_de_estacao_alheia(self):
        self.client.force_authenticate(self.usuario2)
        resposta = self.client.post('/api/rssi/solicitar/', {'sensor_id': 'EST_1'})
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(SolicitacaoRssi.objects.filter(sensor_id='EST_1', pendente=True).exists())

    def test_leitura_com_rssi_fecha_a_solicitacao_pendente(self):
        """Garante que essa regra pré-existente não quebrou com as
        mudanças (SolicitacaoRssi.obter agora também resolve `estacao`)."""
        self.client.force_authenticate(self.usuario1)
        self.client.post('/api/rssi/solicitar/', {'sensor_id': 'EST_1'})
        self.assertTrue(SolicitacaoRssi.objects.get(sensor_id='EST_1').pendente)

        self.client.post('/api/leituras', {
            'sensor': 'EST_1', 'temperatura': 20, 'umidade': 50,
            'dados_adicionais': {'rssi_ida': -80},
        }, format='json')

        self.assertFalse(SolicitacaoRssi.objects.get(sensor_id='EST_1').pendente)


class EstacaoViewSetTests(APITestCase):
    """RN02/RN14/RN15 (cadastro é ato do Gestor) e RN10 (limite de
    estações por plano)."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(username='gestor1', password='x', role=Usuario.Role.GESTOR)
        self.usuario1 = Usuario.objects.create_user(username='usuario1', password='x')

    def test_usuario_comum_nao_pode_cadastrar_estacao(self):
        self.client.force_authenticate(self.usuario1)
        resposta = self.client.post('/api/estacoes/', {'identificador': 'NOVA_1'})
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_cadastra_estacao_vinculando_uma_conta(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.post('/api/estacoes/', {'identificador': 'NOVA_1', 'usuarios': [self.usuario1.pk]})
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        estacao = Estacao.objects.get(identificador='NOVA_1')
        self.assertEqual(list(estacao.usuarios.all()), [self.usuario1])

    def test_gestor_vincula_varias_contas_na_mesma_estacao(self):
        """A regra central desta mudança: uma estação não tem "dono"
        único — quantas contas o Gestor quiser podem enxergar a mesma
        estação física, todas com o mesmo nível de acesso."""
        usuario2 = Usuario.objects.create_user(username='usuario2', password='x')
        usuario3 = Usuario.objects.create_user(username='usuario3', password='x')

        self.client.force_authenticate(self.gestor)
        resposta = self.client.post(
            '/api/estacoes/', {'identificador': 'COMPARTILHADA', 'usuarios': [self.usuario1.pk, usuario2.pk, usuario3.pk]},
        )
        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        estacao = Estacao.objects.get(identificador='COMPARTILHADA')
        self.assertEqual(estacao.usuarios.count(), 3)

        for usuario in (self.usuario1, usuario2, usuario3):
            self.client.force_authenticate(usuario)
            resposta = self.client.get('/api/estacoes/')
            self.assertIn('COMPARTILHADA', [e['identificador'] for e in resposta.data])

    def test_limite_de_estacoes_do_plano_e_respeitado(self):
        """RN10: usuario1 está no plano Standard (max_estacoes=1 no
        setUp) e já tem uma estação — uma segunda deve ser bloqueada,
        mesmo sendo o Gestor quem está cadastrando."""
        plano = Plano.objects.create(nome='Standard-teste', dias_historico=30, max_estacoes=1)
        Assinatura.objects.create(usuario=self.usuario1, plano=plano)
        criar_estacao('JA_EXISTENTE', self.usuario1)

        self.client.force_authenticate(self.gestor)
        resposta = self.client.post('/api/estacoes/', {'identificador': 'SEGUNDA', 'usuarios': [self.usuario1.pk]})
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Estacao.objects.filter(usuarios=self.usuario1).count(), 1)

    def test_usuario_comum_ve_so_as_proprias_estacoes(self):
        criar_estacao('MINHA', self.usuario1)
        criar_estacao('ALHEIA', self.gestor)

        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get('/api/estacoes/')
        identificadores = {e['identificador'] for e in resposta.data}
        self.assertEqual(identificadores, {'MINHA'})

    def test_usuario_comum_nao_pode_ver_sensores_orfaos(self):
        """RN01: só o Gestor vê a lista de sensores sem dono (é dali que
        ele atribui uma estação a alguém) — um Usuário comum não tem
        por que enxergar sensores de outras contas."""
        Leitura.objects.create(sensor_id='SEM_DONO', temperatura=20, umidade=50, data_hora=timezone.now())

        self.client.force_authenticate(self.usuario1)
        resposta = self.client.get('/api/estacoes/orfas/')
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_gestor_ve_sensores_orfaos(self):
        Leitura.objects.create(sensor_id='SEM_DONO', temperatura=20, umidade=50, data_hora=timezone.now())

        self.client.force_authenticate(self.gestor)
        resposta = self.client.get('/api/estacoes/orfas/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual([o['sensor_id'] for o in resposta.data], ['SEM_DONO'])


class LeiturasOrfasPorSensorTests(APITestCase):
    """Exclusão de leituras soltas (sem Estacao vinculada) por sensor_id —
    limpeza de dado de teste/typo, sem tocar no histórico de uma Estacao
    de verdade."""

    def setUp(self):
        self.gestor = Usuario.objects.create_user(username='gestor1', password='x', role=Usuario.Role.GESTOR)
        self.usuario1 = Usuario.objects.create_user(username='usuario1', password='x')

    def test_usuario_comum_nao_pode_excluir_leituras_orfas(self):
        Leitura.objects.create(sensor_id='TESTE', temperatura=20, umidade=50, data_hora=timezone.now())

        self.client.force_authenticate(self.usuario1)
        resposta = self.client.delete('/api/leituras/orfas/TESTE/')
        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Leitura.objects.filter(sensor_id='TESTE').count(), 1)

    def test_sem_autenticacao_e_rejeitado(self):
        resposta = self.client.delete('/api/leituras/orfas/TESTE/')
        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_gestor_exclui_leituras_orfas_do_sensor(self):
        Leitura.objects.create(sensor_id='TESTE', temperatura=20, umidade=50, data_hora=timezone.now())
        Leitura.objects.create(sensor_id='TESTE', temperatura=21, umidade=51, data_hora=timezone.now())
        SolicitacaoRssi.objects.create(sensor_id='TESTE')

        self.client.force_authenticate(self.gestor)
        resposta = self.client.delete('/api/leituras/orfas/TESTE/')
        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['quantidade'], 2)
        self.assertEqual(Leitura.objects.filter(sensor_id='TESTE').count(), 0)
        self.assertEqual(SolicitacaoRssi.objects.filter(sensor_id='TESTE').count(), 0)

    def test_nao_apaga_leituras_de_estacao_cadastrada(self):
        """Só apaga leituras SEM estação — não é uma forma alternativa de
        limpar histórico de sensor de verdade (isso é papel da tela de
        Manutenção, propositalmente mais burocrática)."""
        estacao = criar_estacao('REAL', self.usuario1)
        Leitura.objects.create(sensor_id='REAL', estacao=estacao, temperatura=20, umidade=50, data_hora=timezone.now())

        self.client.force_authenticate(self.gestor)
        resposta = self.client.delete('/api/leituras/orfas/REAL/')
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(Leitura.objects.filter(sensor_id='REAL').count(), 1)

    def test_sensor_sem_leituras_orfas_retorna_404(self):
        self.client.force_authenticate(self.gestor)
        resposta = self.client.delete('/api/leituras/orfas/NAO_EXISTE/')
        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)


class _ViewFalsa:
    """Stub mínimo só para exercitar RecursoDoPlano.has_permission, que só
    olha `view.recurso_requerido` — não existe ainda nenhum endpoint real
    de modelo preditivo (fora de escopo desta fase) para testar via HTTP."""

    def __init__(self, recurso_requerido=None):
        self.recurso_requerido = recurso_requerido


class RecursoDoPlanoPermissionTests(TestCase):
    """RN09/RN11: bloquear acesso a um recurso fora do plano, sem vazar
    dado — e RN01, Gestor sempre passa."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = RecursoDoPlano()
        # Código próprio de teste (não colide com o catálogo semeado pela
        # migration contas.0002_seed_planos, que já roda no banco de teste).
        self.codigo_recurso = 'recurso_de_teste_rn11'
        self.funcionalidade = Funcionalidade.objects.create(codigo=self.codigo_recurso, nome='Recurso de teste')
        self.plano_com_recurso = Plano.objects.create(nome='Plano-com-recurso-teste', dias_historico=365)
        self.plano_com_recurso.funcionalidades.add(self.funcionalidade)
        self.plano_sem_recurso = Plano.objects.create(nome='Plano-sem-recurso-teste', dias_historico=30)

    def _request_de(self, usuario):
        request = self.factory.get('/qualquer-coisa/')
        request.user = usuario
        return request

    def test_view_sem_recurso_requerido_nao_e_afetada(self):
        usuario = Usuario.objects.create_user(username='u1', password='x')
        view = _ViewFalsa(recurso_requerido=None)
        self.assertTrue(self.permission.has_permission(self._request_de(usuario), view))

    def test_gestor_sempre_passa_independente_do_plano(self):
        gestor = Usuario.objects.create_user(username='g1', password='x', role=Usuario.Role.GESTOR)
        view = _ViewFalsa(recurso_requerido=self.codigo_recurso)
        self.assertTrue(self.permission.has_permission(self._request_de(gestor), view))

    def test_usuario_sem_assinatura_e_bloqueado(self):
        usuario = Usuario.objects.create_user(username='u2', password='x')
        view = _ViewFalsa(recurso_requerido=self.codigo_recurso)
        self.assertFalse(self.permission.has_permission(self._request_de(usuario), view))

    def test_usuario_com_plano_sem_o_recurso_e_bloqueado(self):
        usuario = Usuario.objects.create_user(username='u3', password='x')
        Assinatura.objects.create(usuario=usuario, plano=self.plano_sem_recurso)
        view = _ViewFalsa(recurso_requerido=self.codigo_recurso)
        self.assertFalse(self.permission.has_permission(self._request_de(usuario), view))

    def test_usuario_com_plano_que_libera_o_recurso_passa(self):
        usuario = Usuario.objects.create_user(username='u4', password='x')
        Assinatura.objects.create(usuario=usuario, plano=self.plano_com_recurso)
        view = _ViewFalsa(recurso_requerido=self.codigo_recurso)
        self.assertTrue(self.permission.has_permission(self._request_de(usuario), view))

    def test_usuario_inadimplente_e_bloqueado_mesmo_com_plano_certo(self):
        """RN06: assinatura precisa estar em dia (sem pendência financeira)."""
        usuario = Usuario.objects.create_user(username='u5', password='x')
        Assinatura.objects.create(
            usuario=usuario, plano=self.plano_com_recurso, status=Assinatura.Status.INADIMPLENTE,
        )
        view = _ViewFalsa(recurso_requerido=self.codigo_recurso)
        self.assertFalse(self.permission.has_permission(self._request_de(usuario), view))
