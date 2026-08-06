import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts'
import { BarChart3 } from 'lucide-react'
import styles from './SensorAtualBarChart.module.css'

// Uma barra colorida por sensor com o valor atual de cada um — visão
// rápida de "quem está mais quente agora" na Visão Geral. "dados" no
// formato [{ sensorId: 'ESP32_01', valor: 21.5, cor: '#2563eb' }, ...],
// já na mesma ordem/cor usada na tabela e nos gráficos de linha.
function SensorAtualBarChart({ titulo, dados, unidade }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <BarChart3 size={18} />
        {titulo}
      </h2>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={dados} margin={{ top: 24, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="sensorId"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            unit={unidade}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            formatter={(valor) => [`${valor}${unidade}`, 'Atual']}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
            {dados.map((ponto) => (
              <Cell key={ponto.sensorId} fill={ponto.cor} />
            ))}
            <LabelList
              dataKey="valor"
              position="top"
              formatter={(valor) => `${valor}${unidade}`}
              style={{ fontSize: 12, fontWeight: 700, fill: 'var(--color-text)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SensorAtualBarChart
