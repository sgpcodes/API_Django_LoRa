import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

// Um gráfico de uma métrica só (área ou barra, ver `metrica.tipo` em
// services/metricasClima.js) — reaproveitado pelo carrossel do Dashboard,
// pelo modal "ver todas as métricas" e pela grade de 5 gráficos da página
// da estação (ver GradeGraficosMetricas.jsx). Chuva usa barra (RF-19: o
// dado é discreto por hora, não faz sentido interpolar como área).
//
// Cada métrica tem sua própria cor (--metrica-<chave> no theme.css, pedido
// explícito — "gráficos coloridos, cores diferentes") em vez de todas
// usarem o mesmo --chart-line azul.
function GraficoMetrica({ metrica, dados, altura = 280 }) {
  const cor = `var(--metrica-${metrica.chave})`

  if (metrica.tipo === 'barra') {
    return (
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis
            unit={metrica.unidade}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Bar dataKey="valor" fill={cor} radius={[3, 3, 0, 0]} animationDuration={500} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id={`corArea-${metrica.chave}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
        <YAxis
          unit={metrica.unidade}
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke={cor}
          strokeWidth={3}
          fill={`url(#corArea-${metrica.chave})`}
          dot={{ r: 4, strokeWidth: 0, fill: cor }}
          activeDot={{ r: 6 }}
          animationDuration={500}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default GraficoMetrica
