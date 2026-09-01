import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { obterPapelDoToken } from '../services/authService'
import { obterEstacaoVinculada } from '../services/estacaoService'
import AreaAdministrativa from './AreaAdministrativa'
import VincularEstacao from '../pages/VincularEstacao'

// Decide o que aparece logo após o login, seguindo a especificação de
// fluxo (conta Standard): Gestor (conta credenciada/administrativa) não
// usa este dashboard ainda — cai numa área própria, à parte. Usuário
// (Standard/Pro/Plus) passa pela decisão "Primeiro acesso?" do PDF: sem
// estação vinculada, vê a Tela 3 antes de qualquer coisa; com estação, os
// itens do menu (Dashboard, Notificações etc.) renderizam normalmente via
// <Outlet />.
function PortaDeEntradaApp() {
  const papel = obterPapelDoToken()
  const [estacao, setEstacao] = useState(obterEstacaoVinculada)

  if (papel === 'gestor') {
    return <AreaAdministrativa />
  }

  if (!estacao) {
    return <VincularEstacao onVinculado={setEstacao} />
  }

  return <Outlet />
}

export default PortaDeEntradaApp
