import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio, Thermometer, Droplets, Gauge, Wind, Calendar } from 'lucide-react'
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
import { tendenciaUltimaHora } from '../services/metricasClima'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard (Tela 4 da especificação de fluxo). Os dados
// exibidos vêm da estação (ESP32) atribuída à conta pelo admin — ver
// services/climaEstacaoService.js. Enquanto a estação não manda nenhuma
// leitura ainda (acabou de ser atribuída), mostra um aviso em vez de
// dado vazio/quebrado.
const INTERVALO_ATUALIZACAO_MS = 60_000

function Dashboard() {
  const { t, i18n } = useTranslation()
  const OPCOES_PERIODO_TRADUZIDAS = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
  ]
  const [estacao, setEstacao] = useState(null)
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Gráfico e tabela navegam entre métricas (temperatura/umidade/pressão/
  // vento) de forma independente um do outro — só o período é
  // compartilhado (ver seletor logo abaixo do cabeçalho).
  const [indiceGrafico, setIndiceGrafico] = useState(0)
  const [indiceTabela, setIndiceTabela] = useState(0)
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
        setErro(t('dashboard.erroBusca'))
      } finally {
        setCarregando(false)
      }
    }

    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visao = useMemo(() => (clima ? derivarVisaoPeriodo(clima, periodo) : null), [clima, periodo])

  const cabecalho = (
    <CabecalhoStandard identificadorEstacao={estacao?.identificador ?? '—'} estacaoOnline={!estacao?.esta_offline} />
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={t('dashboard.carregando')} />
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
          <h2 className={styles.avisoEstacaoTitulo}>{t('dashboard.aguardandoTitulo')}</h2>
          <p className={styles.avisoEstacaoTexto}>{t('dashboard.aguardandoTexto')}</p>
        </div>
      </div>
    )
  }

  if (!clima) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={t('dashboard.semLeituras')} />
      </div>
    )
  }

  const { resumoTopo } = visao

  // Horário da última leitura chegada (uma só data_hora por leitura, vale
  // pra temperatura/umidade/pressão/vento juntos) e tendência comparando a
  // média da última hora com a da hora anterior — não com "a média do dia
  // anterior" (isso já existe em resumoDia, mas é uma janela grande demais
  // pra responder "subiu ou desceu na última hora").
  const horarioUltimaLeitura = clima.atualizadoEm
    ? new Date(clima.atualizadoEm).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const tendenciaTemperatura = tendenciaUltimaHora(clima.horaria.temperatura)
  const tendenciaUmidade = tendenciaUltimaHora(clima.horaria.umidade)
  const tendenciaPressao = tendenciaUltimaHora(clima.horaria.pressao)

  return (
    <div className={styles.pagina}>
      {cabecalho}

      <div className={styles.seletorPeriodoTopo}>
        <span className={styles.seletorPeriodoRotulo}>
          <Calendar size={14} />
          {t('dashboard.periodoLabel')}
        </span>
        <div className={styles.seletorPeriodoOpcoes}>
          {OPCOES_PERIODO_TRADUZIDAS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              className={`${styles.botaoPeriodoTopo} ${periodo === opcao.valor ? styles.botaoPeriodoTopoAtivo : ''}`}
              onClick={() => setPeriodo(opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.cardsPrincipais}>
        <SummaryStatCard
          icone={Thermometer}
          cor="var(--color-accent)"
          rotulo={t('dashboard.temperatura')}
          valor={resumoTopo.temperatura != null ? `${resumoTopo.temperatura}°C` : '—'}
          legenda={
            tendenciaTemperatura.delta == null
              ? undefined
              : t('dashboard.ultimaHoraTemperatura', { valor: Math.abs(tendenciaTemperatura.delta) })
          }
          tendencia={tendenciaTemperatura.tendencia}
          horarioAtualizacao={horarioUltimaLeitura}
        />
        <SummaryStatCard
          icone={Droplets}
          cor="var(--color-accent)"
          rotulo={t('dashboard.umidade')}
          valor={resumoTopo.umidade != null ? `${resumoTopo.umidade}%` : '—'}
          legenda={
            tendenciaUmidade.delta == null
              ? undefined
              : t('dashboard.ultimaHoraUmidade', { valor: Math.abs(tendenciaUmidade.delta) })
          }
          tendencia={tendenciaUmidade.tendencia}
          horarioAtualizacao={horarioUltimaLeitura}
        />
        <SummaryStatCard
          icone={Gauge}
          cor="var(--color-accent)"
          rotulo={t('dashboard.pressao')}
          valor={resumoTopo.pressao != null ? `${resumoTopo.pressao} hPa` : '—'}
          legenda={
            tendenciaPressao.delta == null
              ? undefined
              : t('dashboard.ultimaHoraPressao', { valor: Math.abs(tendenciaPressao.delta) })
          }
          tendencia={tendenciaPressao.tendencia}
          horarioAtualizacao={horarioUltimaLeitura}
        />
        <SummaryStatCard
          icone={Wind}
          cor="var(--color-accent)"
          rotulo={t('dashboard.vento')}
          valor={resumoTopo.vento.velocidade != null ? `${resumoTopo.vento.velocidade} km/h` : '—'}
          legenda={`${resumoTopo.vento.direcaoTexto} · ${t('dashboard.rajadas')} ${resumoTopo.vento.rajada ?? '—'} km/h`}
          horarioAtualizacao={horarioUltimaLeitura}
        />
      </div>

      <section className={styles.grid2Colunas}>
        <GraficoHistoricoCarrossel grafico={visao.grafico} indice={indiceGrafico} onMudarIndice={setIndiceGrafico} />
        <CondicoesAtuaisCard clima={clima} />
      </section>

      <section className={styles.grid2Colunas}>
        <HistoricoDiarioTable
          tabela={visao.tabela}
          indice={indiceTabela}
          onMudarIndice={setIndiceTabela}
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
