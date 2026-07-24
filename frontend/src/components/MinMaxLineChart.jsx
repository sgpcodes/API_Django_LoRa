import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Activity } from 'lucide-react'
import styles from './MinMaxLineChart.module.css'

// Duas linhas (máxima e mínima) por dia do período selecionado.
// Recebe "dados" no formato:
// [{ rotulo: '16/07', temperaturaMaxima: 28.4, temperaturaMinima: 19.1 }, ...]
function MinMaxLineChart({ dados }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Activity size={18} />
        Temperatura máxima e mínima
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
            unit="°C"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }} />
          <Legend
            iconType="circle"
            formatter={(valor) =>
              valor === 'temperaturaMaxima' ? 'Temperatura máxima (°C)' : 'Temperatura mínima (°C)'
            }
          />
          <Line
            type="monotone"
            dataKey="temperaturaMaxima"
            stroke="var(--color-maxima)"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--color-maxima)' }}
            activeDot={{ r: 6 }}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="temperaturaMinima"
            stroke="var(--color-minima)"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--color-minima)' }}
            activeDot={{ r: 6 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MinMaxLineChart
