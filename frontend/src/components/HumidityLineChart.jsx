import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Droplets } from 'lucide-react'
import styles from './HumidityLineChart.module.css'

// Linha com a umidade média de cada dia do período selecionado.
// Recebe "dados" no formato [{ rotulo: '16/07', umidadeMedia: 65 }, ...].
function HumidityLineChart({ dados }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Droplets size={18} />
        Umidade relativa (média)
      </h2>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            unit="%"
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            formatter={(valor) => [`${valor}%`, 'Umidade média']}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Line
            type="monotone"
            dataKey="umidadeMedia"
            stroke="var(--color-umidade)"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--color-umidade)' }}
            activeDot={{ r: 6 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className={styles.legenda}>
        <span className={styles.marcador} />
        Umidade média (%)
      </p>
    </div>
  )
}

export default HumidityLineChart
