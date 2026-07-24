import styles from './TemperatureDisplay.module.css'

// Elemento principal do dashboard: condição do clima, temperatura atual
// em destaque e uma legenda pequena embaixo. "Icone" é o sol ou a lua
// (definidos pelo tema de horário no Dashboard.jsx).
function TemperatureDisplay({ temperatura, condicao, icone: Icone }) {
  return (
    <div className={styles.container}>
      <span className={styles.condicao}>
        <Icone size={18} />
        {condicao}
      </span>
      <span className={styles.temperatura}>{Math.round(temperatura)}°C</span>
      <span className={styles.legenda}>Temperatura atual</span>
    </div>
  )
}

export default TemperatureDisplay
