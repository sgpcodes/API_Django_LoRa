import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize2 } from 'lucide-react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import GraficoMetrica from './GraficoMetrica'
import Modal from './Modal'
import styles from './GradeGraficosMetricas.module.css'

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
// estação (RF-18: todos juntos, não um de cada vez). Cada um pode ser
// expandido num modal maior; o período (Hoje/Ontem/7/30 dias) é
// compartilhado, escolhido lá em cima na página.
function GradeGraficosMetricas({ grafico, resumoTopo }) {
  const { t } = useTranslation()
  const [metricaExpandida, setMetricaExpandida] = useState(null)

  return (
    <div className={styles.grade}>
      {METRICAS_CLIMA.map((metrica, indice) => {
        const Icone = metrica.icone
        const dados = grafico[metrica.chave] ?? []
        const { maximo, minimo } = maxMinDaSerie(resumoTopo, metrica.chave, dados)
        // As 3 primeiras (temperatura/umidade/pressão) dividem a primeira
        // fileira em terços; as 2 últimas (vento/chuva) dividem a segunda
        // em metades — mesma proporção do mockup de referência.
        const classeSpan = indice < 3 ? styles.spanDeTerco : styles.spanDeMeio

        return (
          <div key={metrica.chave} className={`${styles.cartao} ${classeSpan}`}>
            <div className={styles.cabecalhoCartao}>
              <h3 className={styles.tituloCartao}>
                <Icone size={16} />
                {metrica.titulo}
              </h3>
              <button
                type="button"
                className={styles.botaoExpandir}
                onClick={() => setMetricaExpandida(metrica)}
                aria-label={t('estacaoPagina.expandirGrafico', { metrica: metrica.titulo })}
              >
                <Maximize2 size={13} />
              </button>
            </div>

            <div className={styles.corpoCartao}>
              <div className={styles.areaGrafico}>
                <GraficoMetrica metrica={metrica} dados={dados} altura={190} />
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

      <Modal
        aberto={metricaExpandida != null}
        onFechar={() => setMetricaExpandida(null)}
        titulo={metricaExpandida?.titulo}
        icone={metricaExpandida?.icone}
      >
        {metricaExpandida && <GraficoMetrica metrica={metricaExpandida} dados={grafico[metricaExpandida.chave] ?? []} altura={340} />}
      </Modal>
    </div>
  )
}

export default GradeGraficosMetricas
