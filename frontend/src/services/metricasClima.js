import { Thermometer, Droplets, Gauge, Wind, CloudRain, Sun } from 'lucide-react'

// Lista compartilhada entre a grade de gráficos da página da estação (ver
// GradeGraficosMetricas.jsx) e o card de tempo real (Dashboard.jsx). "chuva"
// usa gráfico de barra (RF-19), as outras usam área — ver `tipo` em
// GraficoMetrica.jsx. "radiacao" é radiação solar de ondas curtas
// (shortwave_radiation da Open-Meteo, W/m²) — insumo padrão pra cálculo de
// evapotranspiração (Penman-Monteith), citado no documento de requisitos.
export const METRICAS_CLIMA = [
  { chave: 'temperatura', titulo: 'Temperatura', unidade: '°C', icone: Thermometer, tipo: 'area' },
  { chave: 'umidade', titulo: 'Umidade', unidade: '%', icone: Droplets, tipo: 'area' },
  { chave: 'pressao', titulo: 'Pressão', unidade: 'hPa', icone: Gauge, tipo: 'area' },
  { chave: 'vento', titulo: 'Vento', unidade: 'km/h', icone: Wind, tipo: 'area' },
  { chave: 'chuva', titulo: 'Chuva', unidade: 'mm', icone: CloudRain, tipo: 'barra' },
  { chave: 'radiacao', titulo: 'Radiação solar', unidade: 'W/m²', icone: Sun, tipo: 'area' },
]

// Compara a última hora com pontos (uma média por hora — ver
// climaEstacaoService.js/climaExternoService.js `horaria.*`) com a hora
// anterior a ela. Sem duas horas com dado real pra comparar, devolve
// tendência indefinida em vez de arriscar um "subiu"/"desceu" errado.
export function tendenciaUltimaHora(serieHoraria) {
  const atual = serieHoraria?.at(-1)?.valor
  const anterior = serieHoraria?.at(-2)?.valor
  if (atual == null || anterior == null) return { delta: null, tendencia: undefined }
  const delta = Number((atual - anterior).toFixed(1))
  if (delta === 0) return { delta, tendencia: undefined }
  return { delta, tendencia: delta > 0 ? 'alta' : 'baixa' }
}
