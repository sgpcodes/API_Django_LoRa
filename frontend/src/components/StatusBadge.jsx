import styles from './StatusBadge.module.css'

// Badge fixo no canto superior indicando que a API respondeu com sucesso
// e qual sensor enviou a leitura mais recente.
function StatusBadge({ sensorId }) {
  return (
    <div className={styles.badge}>
      <div className={styles.linha}>
        <span className={styles.ponto} />
        <span className={styles.titulo}>Sistema online</span>
      </div>
      <span className={styles.subtitulo}>Conectado ao {sensorId}</span>
    </div>
  )
}

export default StatusBadge
