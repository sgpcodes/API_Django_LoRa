import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { METRICAS_CLIMA, OPCOES_PERIODO } from '../services/metricasClima'
import styles from './GraficoHistoricoCarrossel.module.css'

// Gráfico histórico do Dashboard, com setinhas pra passar entre as
// métricas (temperatura, umidade, pressão, vento) sem ocupar mais espaço
// na tela — só um gráfico por vez, igual um carrossel. Controlado de fora
// (índice vem do Dashboard) porque a tabela de histórico logo abaixo
// (HistoricoDiarioTable) navega em conjunto, sincronizada com o mesmo
// índice — trocar aqui troca a tabela também.
function GraficoHistoricoCarrossel({ series, indice, onMudarIndice, diasHistorico, onMudarDiasHistorico }) {
  const [seletorPeriodoAberto, setSeletorPeriodoAberto] = useState(false)
  const metrica = METRICAS_CLIMA[indice]
  const Icone = metrica.icone
  const dados = series[metrica.chave] ?? []

  function irPara(delta) {
    onMudarIndice((METRICAS_CLIMA.length + indice + delta) % METRICAS_CLIMA.length)
  }

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Icone size={18} />
          {metrica.titulo}
        </h2>

        <div className={styles.navegacao}>
          <div className={styles.seletorPeriodo}>
            <button
              type="button"
              className={styles.botaoPeriodo}
              onClick={() => setSeletorPeriodoAberto((atual) => !atual)}
            >
              Últimos {diasHistorico} dias
              <ChevronDown size={13} />
            </button>
            {seletorPeriodoAberto && (
              <div className={styles.dropdownPeriodo}>
                {OPCOES_PERIODO.map((opcao) => (
                  <button
                    key={opcao.dias}
                    type="button"
                    className={styles.itemDropdownPeriodo}
                    onClick={() => {
                      onMudarDiasHistorico(opcao.dias)
                      setSeletorPeriodoAberto(false)
                    }}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className={styles.botaoSeta} onClick={() => irPara(-1)} aria-label="Métrica anterior">
            <ChevronLeft size={16} />
          </button>
          <div className={styles.pontos}>
            {METRICAS_CLIMA.map((item, i) => (
              <span key={item.chave} className={`${styles.ponto} ${i === indice ? styles.pontoAtivo : ''}`} />
            ))}
          </div>
          <button type="button" className={styles.botaoSeta} onClick={() => irPara(1)} aria-label="Próxima métrica">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="corAreaCarrossel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-area-inicio)" />
              <stop offset="100%" stopColor="var(--chart-area-fim)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            unit={metrica.unidade}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              boxShadow: 'var(--shadow-card)',
            }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="var(--chart-line)"
            strokeWidth={3}
            fill="url(#corAreaCarrossel)"
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-line)' }}
            activeDot={{ r: 6 }}
            animationDuration={500}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default GraficoHistoricoCarrossel
