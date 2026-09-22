import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import { derivarVisaoPeriodo } from '../services/climaExternoService'
import GraficoMetrica from './GraficoMetrica'
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

// Os 5 gráficos hora a hora (temperatura, umidade, pressão, vento, chuva)
// lado a lado — substitui o carrossel "um de cada vez" na página da
// estação (RF-18: todos juntos, não um de cada vez). O período de cada um
// segue o seletor global da página (`periodoGlobal`) por padrão, mas pode
// ser trocado individualmente sem afetar os demais (RF-22) — `clima` (o
// objeto bruto, com todo o histórico já buscado) é recalculado localmente
// pra cada período diferente que algum gráfico esteja usando, sem nenhuma
// chamada de rede nova.
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

  return (
    <div className={styles.grade}>
      {METRICAS_CLIMA.filter((metrica) => metrica.chave !== 'vento').map((metrica) => {
        const Icone = metrica.icone
        const periodo = periodoDoGrafico(metrica.chave)
        const visao = derivarVisaoPeriodo(clima, periodo)
        const dados = visao.grafico[metrica.chave] ?? []
        const { maximo, minimo } = maxMinDaSerie(visao.resumoTopo, metrica.chave, dados)
        const personalizado = periodosIndividuais[metrica.chave] != null

        return (
          <div key={metrica.chave} className={`${styles.cartao} ${styles.spanDeMeio}`}>
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
          </div>
        )
      })}

      <div className={styles.spanCheio}>
        <PainelVento
          clima={clima}
          periodo={periodoDoGrafico('vento')}
          onMudarPeriodo={(valor) => aoMudarPeriodoDoGrafico('vento', valor)}
          personalizado={periodosIndividuais.vento != null}
        />
      </div>

      <Modal
        aberto={metricaExpandida != null}
        onFechar={() => setMetricaExpandida(null)}
        titulo={metricaExpandida?.titulo}
        icone={metricaExpandida?.icone}
      >
        {metricaExpandida && (
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
