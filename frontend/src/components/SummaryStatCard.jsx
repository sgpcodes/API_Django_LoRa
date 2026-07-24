import { ArrowUp, ArrowDown } from 'lucide-react'
import styles from './SummaryStatCard.module.css'

// Card usado no resumo do período selecionado (temperatura média, máxima,
// mínima, umidade média). "legenda" é o texto pequeno embaixo do valor;
// "tendencia" ('alta' | 'baixa' | undefined) adiciona uma setinha nela.
function SummaryStatCard({ icone: Icone, cor, rotulo, valor, legenda, tendencia }) {
  const IconeTendencia = tendencia === 'alta' ? ArrowUp : tendencia === 'baixa' ? ArrowDown : null

  return (
    <div className={styles.card}>
      <div className={styles.cabecalho}>
        <div className={styles.iconeFundo} style={{ backgroundColor: cor }}>
          <Icone size={16} color="white" />
        </div>
        <span className={styles.rotulo}>{rotulo}</span>
      </div>
      <span className={styles.valor}>{valor}</span>
      {legenda && (
        <span className={styles.legenda}>
          {IconeTendencia && <IconeTendencia size={12} />}
          {legenda}
        </span>
      )}
    </div>
  )
}

export default SummaryStatCard
