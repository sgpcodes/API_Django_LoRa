import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { obterTemaPorHorario } from '../services/climaService'
import styles from './AppLayout.module.css'

// O tema (dia/noite) segue o relógio do computador por padrão, então
// checamos o horário de tempos em tempos para trocar sozinho caso o
// usuário fique com a página aberta passando das 7h ou das 19h. Isso só
// vale enquanto ele não usar o botão de alternar tema manualmente.
const INTERVALO_VERIFICACAO_TEMA_MS = 60_000

// Casca fixa do app: menu lateral + área de conteúdo, onde cada página
// (Dashboard, Dados do LoRa, Perfil) é renderizada via <Outlet />.
// O tema é controlado aqui porque tanto a sidebar quanto o cabeçalho de
// cada página precisam dele.
function AppLayout() {
  const [tema, setTema] = useState(obterTemaPorHorario)
  const temaEscolhidoManualmente = useRef(false)

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (!temaEscolhidoManualmente.current) {
        setTema(obterTemaPorHorario())
      }
    }, INTERVALO_VERIFICACAO_TEMA_MS)
    return () => clearInterval(intervalo)
  }, [])

  function alternarTema() {
    temaEscolhidoManualmente.current = true
    setTema((atual) => (atual === 'dia' ? 'noite' : 'dia'))
  }

  return (
    <div className={styles.app} data-theme={tema}>
      <Sidebar tema={tema} onAlternarTema={alternarTema} />
      <main className={styles.conteudo}>
        <Outlet context={{ tema, onAlternarTema: alternarTema }} />
      </main>
    </div>
  )
}

export default AppLayout
