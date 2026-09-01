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
