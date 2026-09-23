import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RotaProtegida from './components/RotaProtegida'
import PortaDeEntradaApp from './components/PortaDeEntradaApp'
import PainelAdministrativo from './components/PainelAdministrativo'
import AdminDashboard from './pages/AdminDashboard'
import EstacoesAdmin from './pages/EstacoesAdmin'
import ContasAdmin from './pages/ContasAdmin'
import ManutencaoAdmin from './pages/ManutencaoAdmin'
import PerfilAdmin from './pages/PerfilAdmin'
import AdminConfiguracoes from './pages/AdminConfiguracoes'
import NotificacoesAdmin from './pages/NotificacoesAdmin'
import Dashboard from './pages/Dashboard'
import Notificacoes from './pages/Notificacoes'
import Configuracoes from './pages/Configuracoes'
import GerenciamentoPlano from './pages/GerenciamentoPlano'
import Checkout from './pages/Checkout'
import Perfil from './pages/Perfil'
import Estacao from './pages/Estacao'
import ExportacaoDados from './pages/ExportacaoDados'
// Dashboard antigo (estação LoRa real) — fora do menu por enquanto, mas
// as rotas continuam existindo (ver pages/DashboardLora.jsx).
import DashboardLora from './pages/DashboardLora'
import VisaoGeral from './pages/VisaoGeral'
import DadosLora from './pages/DadosLora'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import ConfirmarEmail from './pages/ConfirmarEmail'
import Planos from './pages/Planos'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Página pública, adaptativa por navegador (ver Login.jsx):
            primeiro acesso -> escolher Entrar/Criar conta; depois disso,
            já abre direto na lista de contas salvas. "/login" é a mesma
            página, só para permitir link direto. */}
        <Route index element={<Login />} />
        <Route path="login" element={<Login />} />
        <Route path="cadastro" element={<Cadastro />} />
        {/* Página que o link do e-mail de confirmação de cadastro abre. */}
        <Route path="confirmar-email/:uidb64/:token" element={<ConfirmarEmail />} />
        {/* Vitrine de planos — não é mais a porta de entrada do site, mas
            continua acessível diretamente. */}
        <Route path="planos" element={<Planos />} />

        {/* Área logada. PortaDeEntradaApp decide o que aparece: Gestor
            (conta credenciada) vai pro Painel Administrativo (/app/adm);
            Usuário (Standard/Pro/Plus) passa pela decisão "já tem estação
            atribuída pelo admin?" antes do menu. */}
        <Route path="app" element={<RotaProtegida />}>
          <Route element={<PortaDeEntradaApp />}>
            <Route path="adm" element={<PainelAdministrativo />}>
              <Route index element={<Navigate to="estacoes" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="estacoes" element={<EstacoesAdmin />} />
              <Route path="contas" element={<ContasAdmin />} />
              <Route path="manutencao" element={<ManutencaoAdmin />} />
              <Route path="perfil" element={<PerfilAdmin />} />
              <Route path="configuracoes" element={<AdminConfiguracoes />} />
              <Route path="notificacoes" element={<NotificacoesAdmin />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="notificacoes" element={<Notificacoes />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="estacao" element={<Estacao />} />
              <Route path="exportar" element={<ExportacaoDados />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="plano" element={<GerenciamentoPlano />} />
              <Route path="checkout" element={<Checkout />} />

              {/* Fora do menu, mas acessíveis direto pela URL — dashboard
                  da estação LoRa real, enquanto ela não substitui a API
                  externa de teste. */}
              <Route path="visao-geral" element={<VisaoGeral />} />
              <Route path="dados-lora" element={<DadosLora />} />
              <Route path="dashboard-lora" element={<DashboardLora />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
