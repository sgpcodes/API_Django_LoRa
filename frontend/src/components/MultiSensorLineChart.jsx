import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { TrendingUp } from 'lucide-react'
import styles from './MultiSensorLineChart.module.css'

// Um gráfico de linhas com uma série por sensor — usado na Visão Geral pra
// comparar todos os dispositivos no mesmo eixo de tempo. "dados" no formato
// [{ hora: '11h', ESP32_01: 21.4, ESP32_02: 23.1 }, ...] (ver
// agruparMediaPorHoraPorSensor em services/leiturasService.js); "sensores"
// e "cores" alinhados por índice — uma linha por sensor, com a cor que ele
// tem no resto da página (tabela e gráfico de barras).
function MultiSensorLineChart({ titulo, icone: Icone = TrendingUp, dados, sensores, cores, unidade }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Icone size={18} />
        {titulo}
      </h2>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis
            dataKey="hora"
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            unit={unidade}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(valor, nome) => [`${valor}${unidade}`, nome]}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {sensores.map((sensorId, indice) => (
            <Line
              key={sensorId}
              type="monotone"
              dataKey={sensorId}
              name={sensorId}
              stroke={cores[indice]}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MultiSensorLineChart
