import { Thermometer, Droplets, Gauge, Wind } from 'lucide-react'

// Lista compartilhada entre o gráfico e a tabela de histórico do Dashboard
// (ver GraficoHistoricoCarrossel.jsx e HistoricoDiarioTable.jsx) — os dois
// navegam pela mesma lista, sincronizados pelo mesmo índice.
export const METRICAS_CLIMA = [
  { chave: 'temperatura', titulo: 'Temperatura', unidade: '°C', icone: Thermometer },
  { chave: 'umidade', titulo: 'Umidade', unidade: '%', icone: Droplets },
  { chave: 'pressao', titulo: 'Pressão', unidade: 'hPa', icone: Gauge },
  { chave: 'vento', titulo: 'Vento', unidade: 'km/h', icone: Wind },
]

// `valor` é o que os dois componentes passam pra `derivarVisaoPeriodo`
// (services/climaExternoService.js) — 'hoje'/'ontem' viram hora a hora
// (sem média); 7/30 viram um ponto por dia (com média, RN: só há média
// quando mais de um dia está selecionado).
export const OPCOES_PERIODO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: 7, rotulo: 'Últimos 7 dias' },
  { valor: 30, rotulo: 'Últimos 30 dias' },
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
