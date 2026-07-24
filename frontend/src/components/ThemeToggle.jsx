import { Sun, Moon } from 'lucide-react'
import styles from './ThemeToggle.module.css'

// Botão para o usuário trocar manualmente entre o tema dia/noite,
// substituindo (até a próxima atualização de página) a escolha
// automática feita pelo horário do computador.
function ThemeToggle({ tema, onAlternar }) {
  const ehNoite = tema === 'noite'

  return (
    <button
      type="button"
      className={styles.botao}
      onClick={onAlternar}
      aria-label="Alternar tema claro/escuro"
    >
      <Sun size={14} className={styles.iconeSol} />
      <span className={styles.trilho}>
        <span className={`${styles.bolinha} ${ehNoite ? styles.bolinhaNoite : ''}`} />
      </span>
      <Moon size={14} className={styles.iconeLua} />
    </button>
  )
}

export default ThemeToggle
