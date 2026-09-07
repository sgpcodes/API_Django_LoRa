import { useEffect, useMemo, useState } from 'react'
import { Radio, Thermometer, Droplets, Gauge, Wind } from 'lucide-react'
import CabecalhoStandard from '../components/CabecalhoStandard'
import SummaryStatCard from '../components/SummaryStatCard'
import GraficoHistoricoCarrossel from '../components/GraficoHistoricoCarrossel'
import CondicoesAtuaisCard from '../components/CondicoesAtuaisCard'
import HistoricoDiarioTable from '../components/HistoricoDiarioTable'
import ResumoDiaCard from '../components/ResumoDiaCard'
import StatusEstacaoCard from '../components/StatusEstacaoCard'
import StatusMessage from '../components/StatusMessage'
import { derivarVisaoPeriodo } from '../services/climaExternoService'
import { buscarClimaDaEstacao } from '../services/climaEstacaoService'
import { buscarMinhaEstacaoPrincipal } from '../services/estacaoService'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard (Tela 4 da especificação de fluxo). Os dados
// exibidos vêm da estação (ESP32) atribuída à conta pelo admin — ver
// services/climaEstacaoService.js. Enquanto a estação não manda nenhuma
// leitura ainda (acabou de ser atribuída), mostra um aviso em vez de
// dado vazio/quebrado.
const INTERVALO_ATUALIZACAO_MS = 60_000

function Dashboard() {
  const [estacao, setEstacao] = useState(null)
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [indiceMetrica, setIndiceMetrica] = useState(0)
  const [periodo, setPeriodo] = useState('hoje')

  // Busca a cada 1 min — a estação atribuída (se mudar, o dashboard troca
  // sozinho de fonte) e o histórico completo dela. Trocar o período
  // (Hoje/Ontem/7/30 dias) não busca de novo, só filtra/agrupa o que já
  // está em `clima` (ver derivarVisaoPeriodo).
  useEffect(() => {
    async function carregar() {
      try {
        const minhaEstacao = await buscarMinhaEstacaoPrincipal()
        setEstacao(minhaEstacao)
        const dados = minhaEstacao ? await buscarClimaDaEstacao(minhaEstacao.identificador) : null
        setClima(dados)
        setErro(null)
      } catch {
        setErro('Não foi possível buscar os dados da estação agora. Tentando de novo em instantes.')
      } finally {
        setCarregando(false)
      }
    }

    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visao = useMemo(() => (clima ? derivarVisaoPeriodo(clima, periodo) : null), [clima, periodo])

  const cabecalho = <CabecalhoStandard identificadorEstacao={estacao?.identificador ?? '—'} />

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando dados da estação..." />
      </div>
    )
  }

  if (erro) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={erro} />
      </div>
    )
  }

  // Sem estação atribuída ainda: só o Dashboard fica bloqueado — o resto
  // do sistema (Perfil, Notificações, Configurações, Plano) continua
  // liberado normalmente pela Sidebar. Atualiza sozinho quando o admin
  // atribuir uma (a busca acima já roda de novo a cada 1 min).
  if (!estacao) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <div className={styles.avisoEstacao}>
          <span className={styles.avisoEstacaoIcone}>
            <Radio size={26} />
          </span>
          <h2 className={styles.avisoEstacaoTitulo}>Aguardando sua estação</h2>
          <p className={styles.avisoEstacaoTexto}>
            Sua conta ainda não tem uma estação meteorológica vinculada. Assim que o administrador atribuir uma a
            você, os dados aparecem aqui automaticamente — o resto do sistema já está liberado.
          </p>
        </div>
      </div>
    )
  }

  if (!clima) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Sua estação ainda não enviou nenhuma leitura. Assim que os dados chegarem, eles aparecem aqui automaticamente." />
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
          <StatusEstacaoCard operacional={!estacao?.esta_offline} />
        </div>
      </section>
    </div>
  )
}

export default Dashboard
