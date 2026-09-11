import { ArrowUp, ArrowDown, Clock } from 'lucide-react'
import styles from './SummaryStatCard.module.css'

const COR_TENDENCIA = { alta: '#16a34a', baixa: '#dc2626' }

// Card usado no resumo do período selecionado (temperatura média, máxima,
// mínima, umidade média). "legenda" é o texto pequeno embaixo do valor;
// "tendencia" ('alta' | 'baixa' | undefined) adiciona uma setinha colorida
// nela (verde subindo, vermelha descendo). "horarioAtualizacao" (opcional)
// mostra quando a última leitura chegou. "progresso" (0-100, opcional)
// desenha uma barrinha embaixo — usado no card "Sensores ativos" da Visão
// Geral.
function SummaryStatCard({ icone: Icone, cor, rotulo, valor, legenda, tendencia, horarioAtualizacao, progresso }) {
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
          {IconeTendencia && <IconeTendencia size={12} color={COR_TENDENCIA[tendencia]} />}
          {legenda}
        </span>
      )}
      {horarioAtualizacao && (
        <span className={styles.horario}>
          <Clock size={11} />
          Última leitura às {horarioAtualizacao}
        </span>
      )}
      {progresso != null && (
        <div className={styles.barraProgresso}>
          <div
            className={styles.barraProgressoPreenchida}
            style={{ width: `${Math.min(100, Math.max(0, progresso))}%`, backgroundColor: cor }}
          />
        </div>
      )}
    </div>
  )
}

export default SummaryStatCard
