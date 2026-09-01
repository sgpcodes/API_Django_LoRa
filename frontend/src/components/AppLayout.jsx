import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { obterTemaPorHorario } from '../services/climaService'
import { obterCorPrincipal, salvarCorPrincipal, variaveisCssDaCor } from '../services/aparenciaService'
import styles from './AppLayout.module.css'

// O tema (dia/noite) segue o relógio do computador por padrão, então
// checamos o horário de tempos em tempos para trocar sozinho caso o
// usuário fique com a página aberta passando das 7h ou das 19h. Isso só
// vale enquanto ele não usar o botão de alternar tema manualmente.
const INTERVALO_VERIFICACAO_TEMA_MS = 60_000

// Casca fixa do app: menu lateral + área de conteúdo, onde cada página
// (Dashboard, Dados do LoRa, Perfil) é renderizada via <Outlet />.
// Tema e cor principal são controlados aqui (não em cada página) porque a
// sidebar e o cabeçalho de qualquer página precisam dos dois.
function AppLayout() {
  const [tema, setTema] = useState(obterTemaPorHorario)
  const [corPrincipal, setCorPrincipal] = useState(obterCorPrincipal)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
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

  // Só muda quando a pessoa escolhe de novo em Configurações — nunca
  // sozinha. Salva na hora (mesma conta, mesmo navegador) e já aplica em
  // tudo (as variáveis CSS ficam no elemento raiz do app, herdadas por
  // qualquer componente dentro, sidebar incluída).
  function mudarCorPrincipal(valor) {
    salvarCorPrincipal(valor)
    setCorPrincipal(valor)
  }

  return (
    <div className={styles.app} data-theme={tema} style={variaveisCssDaCor(corPrincipal)}>
      <Sidebar
        tema={tema}
        onAlternarTema={alternarTema}
        abertaMobile={menuMobileAberto}
        onFecharMobile={() => setMenuMobileAberto(false)}
      />
      <main className={styles.conteudo}>
        {/* Só aparece em telas estreitas (ver AppLayout.module.css) — a
            sidebar some pra fora da tela nesse tamanho, então precisa de
            um jeito de trazer ela de volta como um menu gaveta. */}
        <button
          type="button"
          className={styles.botaoMenuMobile}
          onClick={() => setMenuMobileAberto(true)}
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <Outlet
          context={{
            tema,
            onAlternarTema: alternarTema,
            corPrincipal,
            onMudarCorPrincipal: mudarCorPrincipal,
          }}
        />
      </main>
    </div>
  )
}

export default AppLayout
