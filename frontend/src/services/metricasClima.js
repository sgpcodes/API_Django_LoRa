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

export const OPCOES_PERIODO = [
  { dias: 7, rotulo: 'Últimos 7 dias' },
  { dias: 30, rotulo: 'Últimos 30 dias' },
]
