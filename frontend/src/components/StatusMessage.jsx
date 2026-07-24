import styles from './StatusMessage.module.css'

// Mensagem central usada enquanto os dados carregam ou quando algo dá
// errado (ex.: backend fora do ar), evitando deixar a tela em branco.
function StatusMessage({ texto }) {
  return (
    <div className={styles.container}>
      <p className={styles.texto}>{texto}</p>
    </div>
  )
}

export default StatusMessage
