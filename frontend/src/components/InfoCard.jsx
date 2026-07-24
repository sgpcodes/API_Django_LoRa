import styles from './InfoCard.module.css'

// Card pequeno e reutilizável para exibir um dado de apoio
// (umidade, sensor utilizado, horário da última atualização).
// "Icone" recebe um componente de ícone da lib lucide-react (ex.: Droplet).
function InfoCard({ icone: Icone, rotulo, valor }) {
  return (
    <div className={styles.card}>
      <div className={styles.iconeFundo}>
        <Icone size={18} className={styles.icone} />
      </div>
      <div className={styles.textos}>
        <span className={styles.rotulo}>{rotulo}</span>
        <span className={styles.valor}>{valor}</span>
      </div>
    </div>
  )
}

export default InfoCard
