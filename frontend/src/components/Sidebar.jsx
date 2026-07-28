import { NavLink } from 'react-router-dom'
import { LayoutGrid, Wifi, Settings, HelpCircle, LogOut, Sun, Moon } from 'lucide-react'
import styles from './Sidebar.module.css'

const ITENS_NAV = [
  { to: '/', rotulo: 'Dashboard', icone: LayoutGrid, fim: true },
  { to: '/dados-lora', rotulo: 'Dados do LoRa', icone: Wifi, badge: 'OFF' },
  { to: '/configuracoes', rotulo: 'Configurações', icone: Settings },
]

// Menu lateral fixo: navegação entre as páginas, e atalho de tema no rodapé.
// "Dados do LoRa" e "Configurações" ainda não têm conteúdo (páginas em branco).
function Sidebar({ tema, onAlternarTema }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.marca}>
        <span className={styles.nomeMarca}>LACOP UFF</span>
      </div>

      <nav className={styles.nav}>
        {ITENS_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fim}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
          >
            <item.icone size={18} />
            <span className={styles.rotuloLink}>{item.rotulo}</span>
            {item.badge && <span className={styles.badgeOff}>{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.rodape}>
        <button type="button" className={styles.link}>
          <HelpCircle size={18} />
          <span className={styles.rotuloLink}>Ajuda</span>
        </button>
        <button type="button" className={styles.link}>
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
