import { useTranslation } from 'react-i18next'
import { ArrowUp, ArrowDown, Clock } from 'lucide-react'
import styles from './SummaryStatCard.module.css'

const COR_TENDENCIA = { alta: '#16a34a', baixa: '#dc2626' }

// Card usado no resumo do período selecionado (temperatura média, máxima,
// mínima, umidade média). "legenda" é o texto pequeno embaixo do valor;
// "tendencia" ('alta' | 'baixa' | undefined) adiciona uma setinha colorida
// nela (verde subindo, vermelha descendo). "horarioAtualizacao" (opcional)
// mostra quando a última leitura chegou. "progresso" (0-100, opcional)
// desenha uma barrinha embaixo — usado no card "Sensores ativos" da Visão
// Geral. "maxMin" (opcional, { maximo, minimo, rotuloMaximo, rotuloMinimo,
// unidade }) desenha a linha "Máx. do dia | Mín. do dia" — usada na tira de
// tempo real da página da estação; "—" quando o valor ainda não existe
// (fonte real sem aquele sensor, ex.: chuva na estação física).
function SummaryStatCard({
  icone: Icone,
  cor,
  rotulo,
  valor,
  legenda,
  tendencia,
  horarioAtualizacao,
  progresso,
  maxMin,
}) {
  const { t } = useTranslation()
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
          {t('comum.ultimaLeitura', { horario: horarioAtualizacao })}
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
      {maxMin && (
        <div className={styles.maxMin}>
          <span>
            {maxMin.rotuloMaximo ?? t('comum.maximoDoDia')}{' '}
            <strong>{maxMin.maximo != null ? `${maxMin.maximo}${maxMin.unidade ?? ''}` : '—'}</strong>
          </span>
          <span>
            {maxMin.rotuloMinimo ?? t('comum.minimoDoDia')}{' '}
            <strong>{maxMin.minimo != null ? `${maxMin.minimo}${maxMin.unidade ?? ''}` : '—'}</strong>
          </span>
        </div>
      )}
    </div>
  )
}

export default SummaryStatCard
