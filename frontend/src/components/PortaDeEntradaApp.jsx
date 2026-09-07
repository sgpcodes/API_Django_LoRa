import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { obterPapelDoToken } from '../services/authService'

// Decide o que aparece logo após o login. Gestor (conta credenciada/
// administrativa) cai no Painel Administrativo (/app/adm/*) — nunca vê o
// menu do Usuário comum. Usuário (Standard/Pro/Plus) vai direto pro menu
// normal (Dashboard, Notificações, Configurações, Plano) via <Outlet />
// — não tem mais "porta fechada" esperando estação: quem ainda não tem
// uma vinculada usa o sistema inteiro normalmente, só o Dashboard fica
// mostrando um aviso próprio até o admin atribuir uma (ver Dashboard.jsx).
function PortaDeEntradaApp() {
  const papel = obterPapelDoToken()
  const location = useLocation()

  if (papel === 'gestor' && !location.pathname.startsWith('/app/adm')) {
    return <Navigate to="/app/adm/estacoes" replace />
  }

  return <Outlet />
}

export default PortaDeEntradaApp
