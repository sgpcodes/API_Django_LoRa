import { useState } from 'react'
import { Calendar, Filter } from 'lucide-react'
import styles from './PeriodFilter.module.css'

const OPCOES_RAPIDAS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

// Filtro de período usado para consultar o histórico gravado no MongoDB.
// As opções rápidas aplicam o filtro na hora; "Personalizado" revela os
// dois seletores de data, que só valem depois de clicar em "Aplicar filtro".
function PeriodFilter({ periodo, onEscolherPeriodo, dataInicio, dataFim, onAplicarPersonalizado }) {
  const [rascunhoInicio, setRascunhoInicio] = useState(dataInicio)
  const [rascunhoFim, setRascunhoFim] = useState(dataFim)

  const ehPersonalizado = periodo === 'personalizado'

  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Calendar size={18} />
        Período dos dados
      </h2>

      <div className={styles.linha}>
        <div className={styles.pills}>
          {OPCOES_RAPIDAS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              className={`${styles.pill} ${periodo === opcao.valor ? styles.pillAtivo : ''}`}
              onClick={() => onEscolherPeriodo(opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        {ehPersonalizado && (
          <div className={styles.personalizado}>
            <label className={styles.campoData}>
              <span>De</span>
              <input
                type="date"
                value={rascunhoInicio}
                max={rascunhoFim}
                onChange={(evento) => setRascunhoInicio(evento.target.value)}
              />
            </label>
            <label className={styles.campoData}>
              <span>Até</span>
              <input
                type="date"
                value={rascunhoFim}
                min={rascunhoInicio}
                onChange={(evento) => setRascunhoFim(evento.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.botaoAplicar}
              onClick={() => onAplicarPersonalizado(rascunhoInicio, rascunhoFim)}
            >
              <Filter size={16} />
              Aplicar filtro
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PeriodFilter
