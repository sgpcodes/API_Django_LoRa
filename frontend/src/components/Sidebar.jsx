import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutGrid, Wifi, User, HelpCircle, LogOut, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react'
import logoLacop from '../assets/lacop.png'
import styles from './Sidebar.module.css'

const ITENS_NAV = [
  { to: '/', rotulo: 'Dashboard', icone: LayoutGrid, fim: true },
  { to: '/dados-lora', rotulo: 'Dados do LoRa', icone: Wifi, badge: 'OFF' },
  { to: '/perfil', rotulo: 'Perfil', icone: User },
]

// Menu lateral fixo: navegação entre as páginas, e atalho de tema no rodapé.
// Pode ser recolhida (fica só com os ícones). Recolhida, clicar no ícone de
// uma aba navega normalmente; clicar no resto da aba (fora do ícone) expande
// o menu de volta em vez de navegar.
function Sidebar({ tema, onAlternarTema }) {
  const [recolhida, setRecolhida] = useState(false)

  function aoClicarAba(evento) {
    if (recolhida && !evento.target.closest(`.${styles.iconeLink}`)) {
      evento.preventDefault()
      setRecolhida(false)
    }
  }

  return (
    <aside className={`${styles.sidebar} ${recolhida ? styles.sidebarRecolhida : ''}`}>
      <button
        type="button"
        className={styles.botaoRecolher}
        onClick={() => setRecolhida((atual) => !atual)}
        aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
      >
        {recolhida ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={styles.marca}>
        <img src={logoLacop} alt="LACOP UFF" className={styles.logoMarca} />
      </div>

      <nav className={styles.nav}>
        {ITENS_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fim}
            title={item.rotulo}
            onClick={aoClicarAba}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
          >
            <span className={styles.iconeLink}>
              <item.icone size={18} />
            </span>
            <span className={styles.rotuloLink}>{item.rotulo}</span>
            {item.badge && <span className={styles.badgeOff}>{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.rodape}>
        <button type="button" className={styles.link} title="Ajuda">
          <HelpCircle size={18} />
          <span className={styles.rotuloLink}>Ajuda</span>
        </button>
        <button type="button" className={styles.link} title="Sair">
          <LogOut size={18} />
          <span className={styles.rotuloLink}>Sair</span>
        </button>

        <div className={styles.temaBloco}>
          <div className={styles.temaBotoes}>
            <button
              type="button"
              className={`${styles.temaBotao} ${tema === 'dia' ? styles.temaBotaoAtivo : ''}`}
              onClick={() => tema !== 'dia' && onAlternarTema()}
              aria-label="Tema claro"
            >
              <Sun size={16} />
            </button>
            <button
              type="button"
              className={`${styles.temaBotao} ${tema === 'noite' ? styles.temaBotaoAtivo : ''}`}
              onClick={() => tema !== 'noite' && onAlternarTema()}
              aria-label="Tema escuro"
            >
              <Moon size={16} />
            </button>
          </div>
          <span className={styles.temaRotulo}>{tema === 'dia' ? 'Tema claro' : 'Tema escuro'}</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
