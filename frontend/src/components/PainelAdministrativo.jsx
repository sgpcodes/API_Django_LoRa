import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Radio, ShieldCheck, Users } from 'lucide-react'
import { logout } from '../services/authService'
import styles from './PainelAdministrativo.module.css'

const ABAS = [
  { to: '/app/adm/estacoes', rotulo: 'Estações', icone: Radio },
  { to: '/app/adm/contas', rotulo: 'Contas', icone: Users },
]

// Casca do Painel Administrativo (destino de quem loga como Gestor):
// cabeçalho fixo + duas abas (Estações / Contas), cada uma sua própria
// tela renderizada via <Outlet />. Layout deliberadamente simples e à
// parte do tema dia/noite/cor de destaque do app do Usuário comum — é uma
// área interna, não uma vitrine.
function PainelAdministrativo() {
  const navigate = useNavigate()

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.pagina} data-theme="dia">
      <header className={styles.cabecalho}>
        <div className={styles.marca}>
          <span className={styles.iconeMarca}>
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className={styles.titulo}>Painel administrativo</span>
            <span className={styles.subtitulo}>LACOP UFF · Monitoramento Agroclimático</span>
          </div>
        </div>

        <nav className={styles.abas}>
          {ABAS.map((aba) => (
            <NavLink
              key={aba.to}
              to={aba.to}
              className={({ isActive }) => `${styles.aba} ${isActive ? styles.abaAtiva : ''}`}
            >
              <aba.icone size={16} />
              {aba.rotulo}
            </NavLink>
          ))}
        </nav>

        <button type="button" className={styles.botaoSair} onClick={aoSair}>
          <LogOut size={16} />
          Sair
        </button>
      </header>

      <main className={styles.conteudo}>
        <Outlet />
      </main>
    </div>
  )
}

export default PainelAdministrativo
