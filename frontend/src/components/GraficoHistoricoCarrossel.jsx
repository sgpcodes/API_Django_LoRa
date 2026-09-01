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
import { ChevronLeft, ChevronRight, Thermometer, Droplets, Gauge, Wind } from 'lucide-react'
import styles from './GraficoHistoricoCarrossel.module.css'

// Uma métrica por "página" do carrossel — ícone, título, unidade e a
// chave em `series` (ver climaExternoService.js/seriesHistoricoDiario).
const METRICAS = [
  { chave: 'temperatura', titulo: 'Temperatura', unidade: '°C', icone: Thermometer },
  { chave: 'umidade', titulo: 'Umidade', unidade: '%', icone: Droplets },
  { chave: 'pressao', titulo: 'Pressão', unidade: 'hPa', icone: Gauge },
  { chave: 'vento', titulo: 'Vento', unidade: 'km/h', icone: Wind },
]

// Gráfico histórico do Dashboard, com setinhas pra passar entre as
// métricas (temperatura, umidade, pressão, vento) sem ocupar mais espaço
// na tela — só um gráfico por vez, igual um carrossel.
function GraficoHistoricoCarrossel({ series }) {
  const [indice, setIndice] = useState(0)
  const metrica = METRICAS[indice]
  const Icone = metrica.icone
  const dados = series[metrica.chave] ?? []

  function irPara(delta) {
    setIndice((atual) => (atual + delta + METRICAS.length) % METRICAS.length)
  }

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Icone size={18} />
          {metrica.titulo}
        </h2>
        <div className={styles.navegacao}>
          <button type="button" className={styles.botaoSeta} onClick={() => irPara(-1)} aria-label="Métrica anterior">
            <ChevronLeft size={16} />
          </button>
          <div className={styles.pontos}>
            {METRICAS.map((item, i) => (
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
