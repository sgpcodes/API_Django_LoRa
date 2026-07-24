import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import styles from './TemperatureBarChart.module.css'

// Barras com a temperatura média de cada dia do período selecionado.
// Recebe "dados" no formato [{ rotulo: '16/07', temperaturaMedia: 24.7 }, ...].
function TemperatureBarChart({ dados }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <BarChart3 size={18} />
        Evolução da temperatura ({dados.length} {dados.length === 1 ? 'dia' : 'dias'})
      </h2>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
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
          <Tooltip
            formatter={(valor) => [`${valor}°C`, 'Média']}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Bar dataKey="temperaturaMedia" fill="var(--chart-line)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <p className={styles.legenda}>
        <span className={styles.marcador} />
        Temperatura média (°C)
      </p>
    </div>
  )
}

export default TemperatureBarChart
