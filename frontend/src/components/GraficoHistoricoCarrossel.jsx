import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import Modal from './Modal'
import styles from './GraficoHistoricoCarrossel.module.css'

// Um gráfico de área só, reaproveitado tanto pelo carrossel (um de cada
// vez) quanto pelo modal "ver todas as métricas" (os 4 empilhados).
function GraficoMetrica({ metrica, dados, altura = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id={`corArea-${metrica.chave}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-area-inicio)" />
            <stop offset="100%" stopColor="var(--chart-area-fim)" />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
        <XAxis
          dataKey="rotulo"
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          unit={metrica.unidade}
          tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
          contentStyle={{
            borderRadius: 12,
            border: 'none',
            boxShadow: 'var(--shadow-card)',
          }}
        />
        <Area
          type="monotone"
          dataKey="valor"
          stroke="var(--chart-line)"
          strokeWidth={3}
          fill={`url(#corArea-${metrica.chave})`}
          dot={{ r: 4, strokeWidth: 0, fill: 'var(--chart-line)' }}
          activeDot={{ r: 6 }}
          animationDuration={500}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Gráfico histórico do Dashboard, com setinhas pra passar entre as
// métricas (temperatura, umidade, pressão, vento) sem ocupar mais espaço
// na tela — só um gráfico por vez, igual um carrossel. O período (Hoje/
// Ontem/7/30 dias) não é mais escolhido aqui — vem de um seletor único lá
// em cima do Dashboard, compartilhado com a tabela de histórico (só a
// navegação por métrica é independente entre gráfico e tabela).
//
// Botão "expandir" abre uma janela grande com as 4 métricas de uma vez,
// pra quem quer comparar sem ficar clicando na seta.
function GraficoHistoricoCarrossel({ grafico, indice, onMudarIndice }) {
  const [modalAberto, setModalAberto] = useState(false)
  const metrica = METRICAS_CLIMA[indice]
  const Icone = metrica.icone
  const dados = grafico[metrica.chave] ?? []

  function irPara(delta) {
    onMudarIndice((METRICAS_CLIMA.length + indice + delta) % METRICAS_CLIMA.length)
  }

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Icone size={18} />
          {metrica.titulo}
        </h2>

        <div className={styles.navegacao}>
          <button
            type="button"
            className={styles.botaoSeta}
            onClick={() => setModalAberto(true)}
            aria-label="Expandir — ver todas as métricas"
            title="Ver todas as métricas"
          >
            <Maximize2 size={15} />
          </button>
          <button type="button" className={styles.botaoSeta} onClick={() => irPara(-1)} aria-label="Métrica anterior">
            <ChevronLeft size={16} />
          </button>
          <div className={styles.pontos}>
            {METRICAS_CLIMA.map((item, i) => (
              <span key={item.chave} className={`${styles.ponto} ${i === indice ? styles.pontoAtivo : ''}`} />
            ))}
          </div>
          <button type="button" className={styles.botaoSeta} onClick={() => irPara(1)} aria-label="Próxima métrica">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <GraficoMetrica metrica={metrica} dados={dados} />

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Todas as métricas" icone={Maximize2}>
        <div className={styles.grademodal}>
          {METRICAS_CLIMA.map((item) => (
            <div key={item.chave} className={styles.itemModal}>
              <h3 className={styles.tituloModal}>
                <item.icone size={16} />
                {item.titulo}
              </h3>
              <GraficoMetrica metrica={item} dados={grafico[item.chave] ?? []} altura={220} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default GraficoHistoricoCarrossel
