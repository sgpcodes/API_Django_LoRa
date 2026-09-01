import { useEffect, useMemo, useState } from 'react'
import { Thermometer, Droplets, Gauge, Wind } from 'lucide-react'
import CabecalhoStandard from '../components/CabecalhoStandard'
import SummaryStatCard from '../components/SummaryStatCard'
import GraficoHistoricoCarrossel from '../components/GraficoHistoricoCarrossel'
import CondicoesAtuaisCard from '../components/CondicoesAtuaisCard'
import HistoricoDiarioTable from '../components/HistoricoDiarioTable'
import ResumoDiaCard from '../components/ResumoDiaCard'
import StatusEstacaoCard from '../components/StatusEstacaoCard'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual, derivarVisaoPeriodo } from '../services/climaExternoService'
import { obterEstacaoVinculada } from '../services/estacaoService'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard (Tela 4 da especificação de fluxo). Os dados
// exibidos vêm de uma API externa de meteorologia enquanto a estação LoRa
// própria não está pronta com todos os sensores — ver
// services/climaExternoService.js. O dashboard que lê a estação de
// verdade (services/leiturasService.js) continua existindo, só não está
// ligado por enquanto — ver pages/DashboardLora.jsx.
const INTERVALO_ATUALIZACAO_MS = 15 * 60_000

function Dashboard() {
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [indiceMetrica, setIndiceMetrica] = useState(0)
  const [periodo, setPeriodo] = useState('hoje')

  const estacao = obterEstacaoVinculada()

  // Busca só uma vez (e a cada 15min) — os últimos 30 dias inteiros já vêm
  // de uma vez. Trocar o período (Hoje/Ontem/7/30 dias) não busca de novo,
  // só filtra/agrupa o que já está em `clima` (ver derivarVisaoPeriodo).
  useEffect(() => {
    async function carregarClima() {
      try {
        const dados = await buscarClimaAtual()
        setClima(dados)
        setErro(null)
      } catch {
        setErro('Não foi possível buscar os dados de clima agora. Tentando de novo em instantes.')
      } finally {
        setCarregando(false)
      }
    }

    carregarClima()
    const intervalo = setInterval(carregarClima, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visao = useMemo(() => (clima ? derivarVisaoPeriodo(clima, periodo) : null), [clima, periodo])

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

  const { resumoTopo } = visao

  return (
    <div className={styles.pagina}>
      {cabecalho}

      <div className={styles.cardsPrincipais}>
        <SummaryStatCard
          icone={Thermometer}
          cor="var(--color-accent)"
          rotulo="Temperatura"
          valor={resumoTopo.temperatura != null ? `${resumoTopo.temperatura}°C` : '—'}
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
          valor={resumoTopo.umidade != null ? `${resumoTopo.umidade}%` : '—'}
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
          valor={resumoTopo.pressao != null ? `${resumoTopo.pressao} hPa` : '—'}
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
          valor={resumoTopo.vento.velocidade != null ? `${resumoTopo.vento.velocidade} km/h` : '—'}
          legenda={`${resumoTopo.vento.direcaoTexto} · Rajadas ${resumoTopo.vento.rajada ?? '—'} km/h`}
        />
      </div>

      <section className={styles.grid2Colunas}>
        <GraficoHistoricoCarrossel
          grafico={visao.grafico}
          indice={indiceMetrica}
          onMudarIndice={setIndiceMetrica}
          periodo={periodo}
          onMudarPeriodo={setPeriodo}
        />
        <CondicoesAtuaisCard clima={clima} />
      </section>

      <section className={styles.grid2Colunas}>
        <HistoricoDiarioTable
          tabela={visao.tabela}
          indice={indiceMetrica}
          periodo={periodo}
          granularidade={visao.granularidade}
        />
        <div className={styles.colunaLateral}>
          <ResumoDiaCard resumo={clima.resumoDia} />
          <StatusEstacaoCard operacional />
        </div>
      </section>
    </div>
  )
}

export default Dashboard
