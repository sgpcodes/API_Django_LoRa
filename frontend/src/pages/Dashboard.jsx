import { useEffect, useState } from 'react'
import { Thermometer, Droplets, Gauge, Wind } from 'lucide-react'
import CabecalhoStandard from '../components/CabecalhoStandard'
import SummaryStatCard from '../components/SummaryStatCard'
import GraficoHistoricoCarrossel from '../components/GraficoHistoricoCarrossel'
import CondicoesAtuaisCard from '../components/CondicoesAtuaisCard'
import HistoricoDiarioTable from '../components/HistoricoDiarioTable'
import ResumoDiaCard from '../components/ResumoDiaCard'
import StatusEstacaoCard from '../components/StatusEstacaoCard'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual } from '../services/climaExternoService'
import { obterEstacaoVinculada } from '../services/estacaoService'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard (Tela 4 da especificação de fluxo). Os dados
// exibidos vêm de uma API externa de meteorologia enquanto a estação LoRa
// própria não está pronta com todos os sensores — ver
// services/climaExternoService.js. O dashboard que lê a estação de
// verdade (services/leiturasService.js) continua existindo, só não está
// ligado por enquanto — ver pages/DashboardLora.jsx.
const INTERVALO_ATUALIZACAO_MS = 15 * 60_000
const DIAS_HISTORICO_PADRAO = 7 // só vira 30 (limite do plano Standard, RN09/RN21) se a pessoa escolher

function Dashboard() {
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [indiceMetrica, setIndiceMetrica] = useState(0)
  const [diasHistorico, setDiasHistorico] = useState(DIAS_HISTORICO_PADRAO)

  const estacao = obterEstacaoVinculada()

  useEffect(() => {
    async function carregarClima() {
      try {
        const dados = await buscarClimaAtual(undefined, diasHistorico)
        setClima(dados)
        setErro(null)
      } catch {
        setErro('Não foi possível buscar os dados de clima agora. Tentando de novo em instantes.')
      } finally {
        setCarregando(false)
      }
    }

    setCarregando(true)
    carregarClima()
    const intervalo = setInterval(carregarClima, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [diasHistorico])

  const cabecalho = <CabecalhoStandard identificadorEstacao={estacao?.identificador ?? '—'} />

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando dados do clima..." />
      </div>
    )
  }

  if (erro || !clima) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={erro ?? 'Nenhum dado disponível.'} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      {cabecalho}

      <div className={styles.cardsPrincipais}>
        <SummaryStatCard
          icone={Thermometer}
          cor="var(--color-accent)"
          rotulo="Temperatura"
          valor={`${clima.temperatura}°C`}
          legenda={
            clima.resumoDia.deltaTemperatura == null
              ? undefined
              : `${Math.abs(clima.resumoDia.deltaTemperatura)}°C ${clima.resumoDia.deltaTemperatura >= 0 ? 'acima' : 'abaixo'} da média anterior`
          }
          tendencia={
            clima.resumoDia.deltaTemperatura == null
              ? undefined
              : clima.resumoDia.deltaTemperatura >= 0
                ? 'alta'
                : 'baixa'
          }
        />
        <SummaryStatCard
          icone={Droplets}
          cor="var(--color-accent)"
          rotulo="Umidade"
          valor={`${clima.umidade}%`}
          legenda={
            clima.resumoDia.deltaUmidade == null
              ? undefined
              : `${Math.abs(clima.resumoDia.deltaUmidade)}% ${clima.resumoDia.deltaUmidade >= 0 ? 'acima' : 'abaixo'} da média anterior`
          }
          tendencia={
            clima.resumoDia.deltaUmidade == null ? undefined : clima.resumoDia.deltaUmidade >= 0 ? 'alta' : 'baixa'
          }
        />
        <SummaryStatCard
          icone={Gauge}
          cor="var(--color-accent)"
          rotulo="Pressão"
          valor={`${clima.pressao} hPa`}
          legenda={
            clima.resumoDia.deltaPressao == null
              ? undefined
              : `${Math.abs(clima.resumoDia.deltaPressao)} hPa ${clima.resumoDia.deltaPressao >= 0 ? 'acima' : 'abaixo'} da média anterior`
          }
          tendencia={
            clima.resumoDia.deltaPressao == null ? undefined : clima.resumoDia.deltaPressao >= 0 ? 'alta' : 'baixa'
          }
        />
        <SummaryStatCard
          icone={Wind}
          cor="var(--color-accent)"
          rotulo="Vento"
          valor={`${clima.vento.velocidade} km/h`}
          legenda={`${clima.vento.direcaoTexto} · Rajadas ${clima.vento.rajada} km/h`}
        />
      </div>

      <section className={styles.grid2Colunas}>
        <GraficoHistoricoCarrossel
          series={clima.seriesHistoricoDiario}
          indice={indiceMetrica}
          onMudarIndice={setIndiceMetrica}
          diasHistorico={diasHistorico}
          onMudarDiasHistorico={setDiasHistorico}
        />
        <CondicoesAtuaisCard clima={clima} />
      </section>

      <section className={styles.grid2Colunas}>
        <HistoricoDiarioTable tabela={clima.tabelaHistoricoDiario} indice={indiceMetrica} diasHistorico={diasHistorico} />
        <div className={styles.colunaLateral}>
          <ResumoDiaCard resumo={clima.resumoDia} />
          <StatusEstacaoCard operacional />
        </div>
      </section>
    </div>
  )
}

export default Dashboard
