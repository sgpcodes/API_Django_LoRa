import { ArrowUp, ArrowDown, Minus, CalendarDays } from 'lucide-react'
import styles from './ResumoDiaCard.module.css'

function LinhaComparativa({ rotulo, valor, delta, unidade }) {
  const Icone = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown
  const classeDelta =
    delta == null || delta === 0 ? styles.deltaNeutro : delta > 0 ? styles.deltaAlta : styles.deltaBaixa

  return (
    <li className={styles.linha}>
      <span className={styles.rotulo}>{rotulo}</span>
      <span className={styles.valores}>
        <span className={styles.valor}>{valor}</span>
        <span className={`${styles.delta} ${classeDelta}`}>
          <Icone size={12} />
          {delta == null ? '—' : `${Math.abs(delta)}${unidade}`}
        </span>
      </span>
    </li>
  )
}

// "Resumo do dia" — compara os valores atuais com a média do dia anterior
// (mesmo ponto de dados do histórico diário do gráfico principal).
function ResumoDiaCard({ resumo }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <CalendarDays size={18} />
        Resumo do dia
      </h2>
      <p className={styles.subtitulo}>Comparativo com a média do dia anterior</p>

      <ul className={styles.lista}>
        <LinhaComparativa
          rotulo="Temperatura média"
          valor={`${resumo.temperaturaMedia ?? '—'}°C`}
          delta={resumo.deltaTemperatura}
          unidade="°C"
        />
        <LinhaComparativa
          rotulo="Umidade média"
          valor={`${resumo.umidadeMedia ?? '—'}%`}
          delta={resumo.deltaUmidade}
          unidade="%"
        />
        <LinhaComparativa
          rotulo="Pressão média"
          valor={`${resumo.pressaoMedia ?? '—'} hPa`}
          delta={resumo.deltaPressao}
          unidade=" hPa"
        />
        <LinhaComparativa
          rotulo="Vento médio"
          valor={`${resumo.ventoMedio ?? '—'} km/h`}
          delta={resumo.deltaVento}
          unidade=" km/h"
        />
      </ul>
    </div>
  )
}

export default ResumoDiaCard
