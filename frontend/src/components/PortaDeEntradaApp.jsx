import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { obterPapelDoToken } from '../services/authService'
import { buscarEstacoes } from '../services/estacaoService'
import AguardandoEstacao from '../pages/AguardandoEstacao'
import StatusMessage from './StatusMessage'

// Decide o que aparece logo após o login. Gestor (conta credenciada/
// administrativa) cai no Painel Administrativo (/app/adm/*) — nunca vê o
// menu do Usuário comum. Usuário (Standard/Pro/Plus) passa pela decisão
// "já tem estação atribuída pelo admin?" (ver AguardandoEstacao) antes de
// qualquer coisa; com estação, os itens do menu (Dashboard, Notificações
// etc.) renderizam normalmente via <Outlet />.
function PortaDeEntradaApp() {
  const papel = obterPapelDoToken()
  const location = useLocation()
  const [estacao, setEstacao] = useState(null)
  const [carregando, setCarregando] = useState(papel !== 'gestor')

  useEffect(() => {
    if (papel === 'gestor') return
    buscarEstacoes()
      .then((estacoes) => setEstacao(estacoes[0] ?? null))
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (papel === 'gestor') {
    if (!location.pathname.startsWith('/app/adm')) {
      return <Navigate to="/app/adm/estacoes" replace />
    }
    return <Outlet />
  }

  if (carregando) {
    return <StatusMessage texto="Carregando..." />
  }

  if (!estacao) {
    return <AguardandoEstacao onEstacaoAtribuida={setEstacao} />
  }

  return <Outlet />
}

export default PortaDeEntradaApp
