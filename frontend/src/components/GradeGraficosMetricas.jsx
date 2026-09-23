import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import { derivarVisaoPeriodo, derivarPontosVento, derivarResumoVento } from '../services/climaExternoService'
import { calcularRosaDosVentos } from '../services/ventoRosa'
import GraficoMetrica from './GraficoMetrica'
import VentoRosa from './VentoRosa'
import PainelVento from './PainelVento'
import Modal from './Modal'
import styles from './GradeGraficosMetricas.module.css'

const OPCOES_PERIODO_GRAFICO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: 7, rotulo: '7 dias' },
  { valor: 30, rotulo: '30 dias' },
]

// Máx./mín. de uma métrica pro cartãozinho ao lado do gráfico: usa o que
// `derivarVisaoPeriodo` já calculou pro dia de hoje (`resumoTopo.maxMin`)
// quando existe; nos outros períodos (sem esse resumo pronto), deriva
// direto da série visível — sempre mostra algo em vez de só "—".
function maxMinDaSerie(resumoTopo, chave, dados) {
  const doDia = resumoTopo?.maxMin?.[chave]
  if (doDia) return doDia
  const valores = dados.map((p) => p.valor).filter((v) => v != null)
  if (valores.length === 0) return { maximo: null, minimo: null }
  return { maximo: Math.max(...valores), minimo: chave === 'chuva' ? 0 : Math.min(...valores) }
}

// Os 6 gráficos hora a hora (temperatura, umidade, pressão, vento, chuva,
// radiação) lado a lado — substitui o carrossel "um de cada vez" na
// página da estação (RF-18: todos juntos, não um de cada vez). O período
// de cada um segue o seletor global da página (`periodoGlobal`) por
// padrão, mas pode ser trocado individualmente sem afetar os demais
// (RF-22) — `clima` (o objeto bruto, com todo o histórico já buscado) é
// recalculado localmente pra cada período diferente que algum gráfico
// esteja usando, sem nenhuma chamada de rede nova.
//
// Vento é o único que não é um GraficoMetrica genérico: mostra a rosa dos
// ventos (compacta, do mesmo tamanho dos outros cartões — pedido
// explícito, "não deixa a rosa muito pequena" mas também "não muito
// grande") em vez de uma linha, e o cartãozinho lateral vira direção
// predominante + rajada máxima em vez de máx./mín.. A versão rica (abas
// rosa/velocidade/direção, os 4 cartões de estatística, legenda) mora no
// modal de expandir — ver PainelVento.jsx.
function GradeGraficosMetricas({ clima, periodoGlobal }) {
  const { t } = useTranslation()
  const [metricaExpandida, setMetricaExpandida] = useState(null)
  // Só guarda uma chave aqui quando o período daquele gráfico DIVERGE do
  // global — assim, se o período global mudar lá em cima, todo gráfico que
  // não foi mexido manualmente acompanha sozinho.
  const [periodosIndividuais, setPeriodosIndividuais] = useState({})

  function periodoDoGrafico(chave) {
    return periodosIndividuais[chave] ?? periodoGlobal
  }

  function aoMudarPeriodoDoGrafico(chave, novoPeriodo) {
    setPeriodosIndividuais((atual) => {
      if (novoPeriodo === periodoGlobal) {
        const proximo = { ...atual }
        delete proximo[chave]
        return proximo
      }
      return { ...atual, [chave]: novoPeriodo }
    })
  }

  const ventoExpandido = metricaExpandida?.chave === 'vento'

  return (
    <div className={styles.grade}>
      {METRICAS_CLIMA.map((metrica, indice) => {
        const Icone = metrica.icone
        const ehVento = metrica.chave === 'vento'
        const periodo = periodoDoGrafico(metrica.chave)
        const visao = derivarVisaoPeriodo(clima, periodo)
        const dados = visao.grafico[metrica.chave] ?? []
        const personalizado = periodosIndividuais[metrica.chave] != null
        // Número ímpar de cartões deixa o último sozinho numa fileira de 2 —
        // em vez de um vão vazio do lado, esse último vira largura cheia.
        const ultimoImpar = indice === METRICAS_CLIMA.length - 1 && METRICAS_CLIMA.length % 2 !== 0
        const classeSpan = ultimoImpar ? styles.spanCheio : styles.spanDeMeio

        let corpo
        if (ehVento) {
          const pontosVento = derivarPontosVento(clima, periodo)
          const rosaVento = calcularRosaDosVentos(pontosVento)
          const resumoVento = derivarResumoVento(clima, periodo)
          const predominante = rosaVento.porDirecao.reduce((maior, atual) => (atual.totalPct > maior.totalPct ? atual : maior), rosaVento.porDirecao[0])

          corpo = (
            <div className={styles.corpoCartao}>
              <div className={styles.areaGrafico}>
                <VentoRosa pontos={pontosVento} altura={230} ocultarLegenda />
              </div>
              <div className={styles.colunaMaxMin}>
                <span>
                  {t('estacaoPagina.direcaoPredominante')}
                  <strong>{rosaVento.total > 0 ? predominante.direcao : '—'}</strong>
                </span>
                <span>
                  {t('estacaoPagina.rajadaMaxima')}
                  <strong>{resumoVento.rajadaMaxima != null ? `${resumoVento.rajadaMaxima} km/h` : '—'}</strong>
                </span>
              </div>
            </div>
          )
        } else {
          const { maximo, minimo } = maxMinDaSerie(visao.resumoTopo, metrica.chave, dados)
          corpo = (
            <div className={styles.corpoCartao}>
              <div className={styles.areaGrafico}>
                <GraficoMetrica metrica={metrica} dados={dados} altura={260} />
              </div>
              <div className={styles.colunaMaxMin}>
                <span>
                  {t('comum.maximoDoDia')}
                  <strong>{maximo != null ? `${maximo}${metrica.unidade}` : '—'}</strong>
                </span>
                <span>
                  {t('comum.minimoDoDia')}
                  <strong>{minimo != null ? `${minimo}${metrica.unidade}` : '—'}</strong>
                </span>
              </div>
            </div>
          )
        }

        return (
          <div key={metrica.chave} className={`${styles.cartao} ${classeSpan}`}>
            <div className={styles.cabecalhoCartao}>
              <h3 className={styles.tituloCartao}>
                <Icone size={16} />
                {metrica.titulo}
              </h3>
              <div className={styles.controlesCartao}>
                <span className={`${styles.seletorPeriodoCartao} ${personalizado ? styles.seletorPeriodoPersonalizado : ''}`}>
                  <select
                    className={styles.selectPeriodoCartao}
                    value={periodo}
                    onChange={(evento) => {
                      const valorBruto = evento.target.value
                      const valor = valorBruto === 'hoje' || valorBruto === 'ontem' ? valorBruto : Number(valorBruto)
                      aoMudarPeriodoDoGrafico(metrica.chave, valor)
                    }}
                    aria-label={t('estacaoPagina.periodoDoGrafico', { metrica: metrica.titulo })}
                    title={personalizado ? t('estacaoPagina.periodoPersonalizado') : undefined}
                  >
                    {OPCOES_PERIODO_GRAFICO.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                </span>
                <button
                  type="button"
                  className={styles.botaoExpandir}
                  onClick={() => setMetricaExpandida(metrica)}
                  aria-label={t('estacaoPagina.expandirGrafico', { metrica: metrica.titulo })}
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            {corpo}
          </div>
        )
      })}

      <Modal
        aberto={metricaExpandida != null}
        onFechar={() => setMetricaExpandida(null)}
        titulo={ventoExpandido ? undefined : metricaExpandida?.titulo}
        icone={ventoExpandido ? undefined : metricaExpandida?.icone}
      >
        {metricaExpandida && ventoExpandido && (
          <PainelVento
            clima={clima}
            periodo={periodoDoGrafico('vento')}
            onMudarPeriodo={(valor) => aoMudarPeriodoDoGrafico('vento', valor)}
            personalizado={periodosIndividuais.vento != null}
          />
        )}
        {metricaExpandida && !ventoExpandido && (
          <GraficoMetrica
            metrica={metricaExpandida}
            dados={derivarVisaoPeriodo(clima, periodoDoGrafico(metricaExpandida.chave)).grafico[metricaExpandida.chave] ?? []}
            altura={420}
          />
        )}
      </Modal>
    </div>
  )
}

export default GradeGraficosMetricas
