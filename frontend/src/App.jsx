import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RotaProtegida from './components/RotaProtegida'
import Dashboard from './pages/Dashboard'
import VisaoGeral from './pages/VisaoGeral'
import DadosLora from './pages/DadosLora'
import Perfil from './pages/Perfil'
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

        {/* Dashboard interno — hoje é, na prática, "o plano de
            gerenciador": só quem loga (Gestor/Usuário) acessa. */}
        <Route path="app" element={<RotaProtegida />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="visao-geral" element={<VisaoGeral />} />
            <Route path="dados-lora" element={<DadosLora />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
