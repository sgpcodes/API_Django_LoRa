import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import styles from './WeatherChart.module.css'

// Gráfico de área com a média de temperatura de cada hora do dia.
// Recebe "dados" no formato [{ hora: '00h', temperaturaMedia: 23.6 }, ...].
// A cor da linha/preenchimento vem das variáveis de tema (--chart-line etc.),
// então ela já muda sozinha entre o tema dia/noite.
function WeatherChart({ dados }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <TrendingUp size={18} />
        Temperatura média por hora
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="corAreaGrafico" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-area-inicio)" />
              <stop offset="100%" stopColor="var(--chart-area-fim)" />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="hora"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            unit="°C"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(valor) => [`${valor}°C`, 'Média']}
            contentStyle={{
              borderRadius: 12,
              border: 'none',
              boxShadow: 'var(--shadow-card)',
            }}
          />
          <Area
            type="monotone"
            dataKey="temperaturaMedia"
            stroke="var(--chart-line)"
            strokeWidth={3}
            fill="url(#corAreaGrafico)"
            dot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-line)' }}
            activeDot={{ r: 6 }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default WeatherChart
