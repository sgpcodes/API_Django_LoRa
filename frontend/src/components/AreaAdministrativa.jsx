import { useNavigate } from 'react-router-dom'
import { Construction, LogOut } from 'lucide-react'
import { logout } from '../services/authService'
import styles from './AreaAdministrativa.module.css'

// Destino de quem loga como Gestor (conta credenciada/administrativa).
// O dashboard de "conta free" (Standard/Pro/Plus) fica só pro papel
// Usuário — ver PortaDeEntradaApp. Esta área ainda vai ser desenhada.
function AreaAdministrativa() {
  const navigate = useNavigate()

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.pagina} data-theme="dia">
      <div className={styles.cartao}>
        <div className={styles.iconeFundo}>
          <Construction size={28} />
        </div>
        <h1 className={styles.titulo}>Área administrativa</h1>
        <p className={styles.texto}>Ainda em construção — em breve.</p>
        <button type="button" className={styles.botaoSair} onClick={aoSair}>
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  )
}

export default AreaAdministrativa
