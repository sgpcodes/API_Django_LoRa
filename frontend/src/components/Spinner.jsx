import styles from './Spinner.module.css'

// Indicador genérico de carregamento — usado em qualquer lugar do
// sistema onde trocar um filtro/seletor dispara uma nova busca (ex.:
// trocar de estado/estação na aba Clima INMET) e a tela ficaria muda
// durante o delay, sem dar nenhum sinal de que algo está acontecendo.
function Spinner({ tamanho = 16, className = '' }) {
  return (
    <svg
      className={`${styles.spinner} ${className}`}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Carregando"
    >
      <circle className={styles.trilha} cx="12" cy="12" r="10" strokeWidth="3" />
      <circle className={styles.arco} cx="12" cy="12" r="10" strokeWidth="3" />
    </svg>
  )
}

export function IndicadorAtualizando({ texto = 'Atualizando...' }) {
  return (
    <span className={styles.indicador}>
      <Spinner tamanho={14} />
      {texto}
    </span>
  )
}

export default Spinner
