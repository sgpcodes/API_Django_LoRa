import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import {
  obterCorPrincipal,
  obterIdioma,
  obterTema,
  salvarCorPrincipal,
  salvarIdioma,
  salvarTema,
  variaveisCssDaCor,
} from '../services/aparenciaService'
import styles from './AppLayout.module.css'

// Casca fixa do app: menu lateral + área de conteúdo, onde cada página
// (Dashboard, Dados do LoRa, Perfil) é renderizada via <Outlet />.
// Tema, cor principal e idioma são controlados aqui (não em cada página)
// porque a sidebar e o cabeçalho de qualquer página precisam dos três.
function AppLayout() {
  const { i18n } = useTranslation()
  const [tema, setTema] = useState(obterTema)
  const [corPrincipal, setCorPrincipal] = useState(obterCorPrincipal)
  const [idioma, setIdioma] = useState(obterIdioma)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  // Aplica a preferência salva dessa conta assim que o layout monta —
  // cobre login/troca de conta sem reload de página inteira (o `lng`
  // inicial do i18next só pega o valor certo num F5, ver i18n/index.js).
  useEffect(() => {
    i18n.changeLanguage(idioma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Só muda quando a pessoa escolhe de novo em Configurações — nunca
  // sozinho. Salva na hora (mesma conta) e troca o idioma de toda a
  // interface imediatamente.
  function mudarIdioma(valor) {
    salvarIdioma(valor)
    setIdioma(valor)
    i18n.changeLanguage(valor)
  }

  // Só muda quando a pessoa clica no botão — nunca sozinho por horário.
  // Salva na hora (mesma conta, mesmo navegador), então fica assim até
  // ela trocar de novo, mesmo depois de recarregar a página.
  function alternarTema() {
    setTema((atual) => {
      const novoTema = atual === 'dia' ? 'noite' : 'dia'
      salvarTema(novoTema)
      return novoTema
    })
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
            idioma,
            onMudarIdioma: mudarIdioma,
          }}
        />
      </main>
    </div>
  )
}

export default AppLayout
