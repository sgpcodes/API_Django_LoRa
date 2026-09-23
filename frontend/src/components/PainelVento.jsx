import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Wind, Gauge, Compass, Zap, Feather, Calendar, Navigation } from 'lucide-react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import { derivarPontosVento, derivarResumoVento, derivarVisaoPeriodo, intervaloDeDatas } from '../services/climaExternoService'
import { DIRECOES, NOME_DIRECAO, FAIXAS_VENTO, calcularRosaDosVentos } from '../services/ventoRosa'
import GraficoMetrica from './GraficoMetrica'
import VentoRosa from './VentoRosa'
import styles from './PainelVento.module.css'

const OPCOES_PERIODO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: 7, rotulo: '7 dias' },
  { valor: 30, rotulo: '30 dias' },
]

const METRICA_VENTO = METRICAS_CLIMA.find((m) => m.chave === 'vento')

function formatarHora(dataHoraISO) {
  if (!dataHoraISO) return '—'
  return new Date(dataHoraISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Barras horizontais de % de tempo por direção (aba "Direção") — mesma
// paleta de magnitude do resto da página (RN dataviz: um valor por
// categoria = uma cor só, não uma cor por barra), escalado contra a maior
// direção pra sempre ter pelo menos uma barra cheia.
function GraficoDirecaoVento({ porDirecao, altura }) {
  const maiorPct = Math.max(...porDirecao.map((d) => d.totalPct), 1)
  return (
    <div className={styles.direcaoLista} style={{ minHeight: altura }}>
      {porDirecao.map(({ direcao, totalPct }) => (
        <div key={direcao} className={styles.direcaoLinha}>
          <span className={styles.direcaoRotulo}>{direcao}</span>
          <div className={styles.direcaoTrilha}>
            <div className={styles.direcaoPreenchida} style={{ width: `${(totalPct / maiorPct) * 100}%` }} />
          </div>
          <span className={styles.direcaoValor}>{totalPct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}

// Card "Vento" — layout próprio (não entra na grade genérica dos outros 4:
// pedido explícito pra ficar igual a uma referência com aba de 3 visões
// (rosa dos ventos / velocidade / direção), cartões de estatística ao lado
// e legenda horizontal embaixo. As 3 abas mostram o MESMO período
// selecionado, cada uma com uma leitura diferente dos dados já buscados
// (nenhuma faz chamada de rede nova).
function PainelVento({ clima, periodo, onMudarPeriodo, personalizado }) {
  const { t } = useTranslation()
  const [aba, setAba] = useState('rosa')

  const pontos = derivarPontosVento(clima, periodo)
  const rosa = calcularRosaDosVentos(pontos)
  const resumo = derivarResumoVento(clima, periodo)
  const dadosVelocidade = derivarVisaoPeriodo(clima, periodo).grafico.vento

  const direcaoPredominante = rosa.porDirecao.reduce((maior, atual) => (atual.totalPct > maior.totalPct ? atual : maior), rosa.porDirecao[0])
  const grausPredominante = direcaoPredominante ? DIRECOES.indexOf(direcaoPredominante.direcao) * 45 : 0

  return (
    <div className={`${styles.cartao} ${personalizado ? styles.cartaoPersonalizado : ''}`}>
      <div className={styles.cabecalho}>
        <div className={styles.tituloBloco}>
          <span className={styles.iconeBadge}>
            <Wind size={22} />
          </span>
          <div>
            <h3 className={styles.titulo}>{t('dashboard.vento')}</h3>
            <p className={styles.subtitulo}>{t('estacaoPagina.ventoSubtitulo')}</p>
          </div>
        </div>

        <label className={styles.seletorData}>
          <Calendar size={14} />
          <span className={styles.intervaloTexto}>{intervaloDeDatas(periodo)}</span>
          <select
            className={styles.selectPeriodo}
            value={periodo}
            onChange={(evento) => {
              const valorBruto = evento.target.value
              onMudarPeriodo(valorBruto === 'hoje' || valorBruto === 'ontem' ? valorBruto : Number(valorBruto))
            }}
            aria-label={t('estacaoPagina.periodoDoGrafico', { metrica: t('dashboard.vento') })}
          >
            {OPCOES_PERIODO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.corpo}>
        <div className={styles.areaPrincipal}>
          <div className={styles.abas}>
            <button type="button" className={aba === 'rosa' ? styles.abaAtiva : styles.aba} onClick={() => setAba('rosa')}>
              <Wind size={14} /> {t('estacaoPagina.abaRosaDosVentos')}
            </button>
            <button type="button" className={aba === 'velocidade' ? styles.abaAtiva : styles.aba} onClick={() => setAba('velocidade')}>
              <Gauge size={14} /> {t('estacaoPagina.abaVelocidade')}
            </button>
            <button type="button" className={aba === 'direcao' ? styles.abaAtiva : styles.aba} onClick={() => setAba('direcao')}>
              <Compass size={14} /> {t('estacaoPagina.abaDirecao')}
            </button>
          </div>

          <div className={styles.graficoWrapper}>
            {aba === 'rosa' && <VentoRosa pontos={pontos} altura={440} ocultarLegenda />}
            {aba === 'velocidade' && <GraficoMetrica metrica={METRICA_VENTO} dados={dadosVelocidade} altura={380} />}
            {aba === 'direcao' && <GraficoDirecaoVento porDirecao={rosa.porDirecao} altura={380} />}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.estatistica}>
            <span className={styles.estatisticaIcone}>
              <Wind size={16} />
            </span>
            <div className={styles.estatisticaCorpo}>
              <span className={styles.estatisticaRotulo}>{t('estacaoPagina.velocidadeMediaVento')}</span>
              <span className={styles.estatisticaValor}>{resumo.media != null ? `${resumo.media} km/h` : '—'}</span>
              {resumo.deltaPct != null && (
                <span className={`${styles.estatisticaDelta} ${resumo.deltaPct >= 0 ? styles.deltaAlta : styles.deltaBaixa}`}>
                  {resumo.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(resumo.deltaPct)}% {t('estacaoPagina.emRelacaoPeriodoAnterior')}
                </span>
              )}
            </div>
          </div>

          <div className={styles.estatistica}>
            <span className={styles.estatisticaIcone}>
              <Compass size={16} />
            </span>
            <div className={styles.estatisticaCorpo}>
              <span className={styles.estatisticaRotulo}>{t('estacaoPagina.direcaoPredominante')}</span>
              <span className={styles.estatisticaValor}>
                {direcaoPredominante ? `${NOME_DIRECAO[direcaoPredominante.direcao]} (${direcaoPredominante.direcao})` : '—'}
              </span>
              {direcaoPredominante && (
                <span className={styles.estatisticaSub}>{t('estacaoPagina.doTempo', { pct: direcaoPredominante.totalPct.toFixed(0) })}</span>
              )}
            </div>
            <Navigation size={18} className={styles.setaDirecao} style={{ transform: `rotate(${grausPredominante}deg)` }} />
          </div>

          <div className={styles.estatistica}>
            <span className={styles.estatisticaIcone}>
              <Zap size={16} />
            </span>
            <div className={styles.estatisticaCorpo}>
              <span className={styles.estatisticaRotulo}>{t('estacaoPagina.rajadaMaxima')}</span>
              <span className={styles.estatisticaValor}>{resumo.rajadaMaxima != null ? `${resumo.rajadaMaxima} km/h` : '—'}</span>
              {resumo.rajadaHorario && <span className={styles.estatisticaSub}>{formatarHora(resumo.rajadaHorario)}</span>}
            </div>
          </div>

          <div className={styles.estatistica}>
            <span className={styles.estatisticaIcone}>
              <Feather size={16} />
            </span>
            <div className={styles.estatisticaCorpo}>
              <span className={styles.estatisticaRotulo}>{t('estacaoPagina.menorVelocidade')}</span>
              <span className={styles.estatisticaValor}>{resumo.menorVelocidade != null ? `${resumo.menorVelocidade} km/h` : '—'}</span>
              {resumo.menorHorario && <span className={styles.estatisticaSub}>{formatarHora(resumo.menorHorario)}</span>}
            </div>
          </div>
        </div>
      </div>

      {aba === 'rosa' && (
        <div className={styles.legendaHorizontal}>
          <span className={styles.legendaTitulo}>{t('estacaoPagina.velocidadeVento')} (km/h)</span>
          <ul className={styles.legendaLista}>
            {[...FAIXAS_VENTO].reverse().map((faixa) => (
              <li key={faixa.chave}>
                <span className={`${styles.legendaAmostra} ${styles[`faixa${faixa.chave}`]}`} />
                {faixa.rotulo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default PainelVento
