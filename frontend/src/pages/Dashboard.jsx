import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudSun, CloudMoon, Sun, Moon, Droplet, Wifi, Clock, Thermometer, ThermometerSun, ThermometerSnowflake, Droplets } from 'lucide-react'
import TemperatureDisplay from '../components/TemperatureDisplay'
import InfoCard from '../components/InfoCard'
import WeatherChart from '../components/WeatherChart'
import StatusMessage from '../components/StatusMessage'
import StatusBadge from '../components/StatusBadge'
import ThemeToggle from '../components/ThemeToggle'
import PeriodFilter from '../components/PeriodFilter'
import SummaryStatCard from '../components/SummaryStatCard'
import HistoryTable from '../components/HistoryTable'
import TemperatureBarChart from '../components/TemperatureBarChart'
import HumidityLineChart from '../components/HumidityLineChart'
import MinMaxLineChart from '../components/MinMaxLineChart'
import {
  buscarLeituras,
  filtrarLeiturasDeHoje,
  agruparMediaPorHora,
  obterLeituraMaisRecente,
  obterIntervaloPeriodo,
  obterIntervaloAnterior,
  filtrarPorPeriodo,
  agruparPorDia,
  calcularResumo,
} from '../services/leiturasService'
import { obterTemaPorHorario, obterCondicaoClima } from '../services/climaService'
import styles from './Dashboard.module.css'

// Busca novas leituras periodicamente para o dashboard se manter atualizado
// sozinho, já que o ESP32 envia uma leitura por minuto.
const INTERVALO_ATUALIZACAO_MS = 60_000

// O tema (dia/noite) segue o relógio do computador por padrão, então
// checamos o horário de tempos em tempos para trocar sozinho caso o
// dashboard fique aberto passando das 7h ou das 19h. Isso só vale
// enquanto o usuário não usar o botão de alternar tema manualmente.
const INTERVALO_VERIFICACAO_TEMA_MS = 60_000

function formatarHorario(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarDataHoraCurta(dataHoraISO) {
  const data = new Date(dataHoraISO)
  const dataFormatada = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const hora = data.getHours()
  return `Registrada em ${dataFormatada} às ${hora}h`
}

function formatarLegendaComparativa(delta, unidade) {
  if (delta == null) return 'Sem período anterior para comparar'
  if (delta === 0) return `Igual à média do período anterior`
  const direcao = delta > 0 ? 'acima' : 'abaixo'
  return `${Math.abs(delta)}${unidade} ${direcao} da média anterior`
}

function paraStringData(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function datasPersonalizadasIniciais() {
  const hoje = new Date()
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(hoje.getDate() - 6)
  return { inicio: paraStringData(seteDiasAtras), fim: paraStringData(hoje) }
}

function Dashboard() {
  const [leituras, setLeituras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tema, setTema] = useState(obterTemaPorHorario)
  const [periodo, setPeriodo] = useState('hoje')
  const [datasPersonalizadas, setDatasPersonalizadas] = useState(datasPersonalizadasIniciais)

  const temaEscolhidoManualmente = useRef(false)

  useEffect(() => {
    async function carregarLeituras() {
      try {
        const dados = await buscarLeituras()
        setLeituras(dados)
        setErro(null)
      } catch {
        setErro('Não foi possível conectar à API. Verifique se o backend está rodando.')
      } finally {
        setCarregando(false)
      }
    }

    carregarLeituras()
    const intervalo = setInterval(carregarLeituras, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (!temaEscolhidoManualmente.current) {
        setTema(obterTemaPorHorario())
      }
    }, INTERVALO_VERIFICACAO_TEMA_MS)
    return () => clearInterval(intervalo)
  }, [])

  function alternarTema() {
    temaEscolhidoManualmente.current = true
    setTema((atual) => (atual === 'dia' ? 'noite' : 'dia'))
  }

  const leituraAtual = useMemo(() => obterLeituraMaisRecente(leituras), [leituras])

  const dadosGraficoHoje = useMemo(() => {
    const leiturasDeHoje = filtrarLeiturasDeHoje(leituras)
    return agruparMediaPorHora(leiturasDeHoje)
  }, [leituras])

  const intervaloSelecionado = useMemo(
    () => obterIntervaloPeriodo(periodo, datasPersonalizadas),
    [periodo, datasPersonalizadas]
  )

  const resumo = useMemo(() => {
    const leiturasDoPeriodo = filtrarPorPeriodo(leituras, intervaloSelecionado)
    const leiturasPeriodoAnterior = filtrarPorPeriodo(
      leituras,
      obterIntervaloAnterior(intervaloSelecionado)
    )
    return calcularResumo(leiturasDoPeriodo, leiturasPeriodoAnterior)
  }, [leituras, intervaloSelecionado])

  const diasComRotulo = useMemo(() => {
    const leiturasDoPeriodo = filtrarPorPeriodo(leituras, intervaloSelecionado)
    return agruparPorDia(leiturasDoPeriodo).map((dia) => ({
      ...dia,
      rotulo: dia.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }))
  }, [leituras, intervaloSelecionado])

  if (carregando) {
    return <StatusMessage texto="Carregando dados do clima..." />
  }

  if (erro) {
    return <StatusMessage texto={erro} />
  }

  if (!leituraAtual) {
    return <StatusMessage texto="Nenhuma leitura cadastrada ainda." />
  }

  const IconeClima = tema === 'dia' ? CloudSun : CloudMoon
  const IconeCondicao = tema === 'dia' ? Sun : Moon

  return (
    <div className={styles.dashboard} data-theme={tema}>
      <div className={styles.fundoDia} aria-hidden="true" />
      <div className={styles.fundoNoite} aria-hidden="true" />

      <div className={styles.pagina}>
        <header className={styles.cabecalho}>
          <div className={styles.marca}>
            <IconeClima size={28} className={styles.iconeClima} />
            <span className={styles.tituloMarca}>Monitoramento Meteorológico</span>
          </div>
          <div className={styles.acoesCabecalho}>
            <StatusBadge sensorId={leituraAtual.sensor_id} />
            <ThemeToggle tema={tema} onAlternar={alternarTema} />
          </div>
        </header>

        <section className={styles.painelPrincipal}>
          <div className={styles.colunaTemperatura}>
            <TemperatureDisplay
              temperatura={leituraAtual.temperatura}
              condicao={obterCondicaoClima(leituraAtual.temperatura)}
              icone={IconeCondicao}
            />
            <div className={styles.infoGrid}>
              <InfoCard icone={Droplet} rotulo="Umidade" valor={`${leituraAtual.umidade}%`} />
              <InfoCard icone={Wifi} rotulo="Sensor" valor={leituraAtual.sensor_id} />
              <InfoCard
                icone={Clock}
                rotulo="Última atualização"
                valor={formatarHorario(leituraAtual.data_hora)}
              />
            </div>
          </div>

          <div className={styles.colunaGrafico}>
            <WeatherChart dados={dadosGraficoHoje} />
          </div>
        </section>

        <PeriodFilter
          periodo={periodo}
          onEscolherPeriodo={setPeriodo}
          dataInicio={datasPersonalizadas.inicio}
          dataFim={datasPersonalizadas.fim}
          onAplicarPersonalizado={(inicio, fim) => {
            setDatasPersonalizadas({ inicio, fim })
            setPeriodo('personalizado')
          }}
        />

        <section className={styles.blocoResumo}>
          <h2 className={styles.tituloSecao}>Resumo do período selecionado</h2>

          {resumo ? (
            <div className={styles.resumoGrid}>
              <SummaryStatCard
                icone={Thermometer}
                cor="var(--color-media)"
                rotulo="Temperatura média"
                valor={`${resumo.temperaturaMedia}°C`}
                legenda={formatarLegendaComparativa(resumo.deltaTemperaturaMedia, '°C')}
                tendencia={
                  resumo.deltaTemperaturaMedia == null
                    ? undefined
                    : resumo.deltaTemperaturaMedia >= 0
                      ? 'alta'
                      : 'baixa'
                }
              />
              <SummaryStatCard
                icone={ThermometerSun}
                cor="var(--color-maxima)"
                rotulo="Temperatura máxima"
                valor={`${resumo.temperaturaMaxima}°C`}
                legenda={formatarDataHoraCurta(resumo.temperaturaMaximaHorario)}
              />
              <SummaryStatCard
                icone={ThermometerSnowflake}
                cor="var(--color-minima)"
                rotulo="Temperatura mínima"
                valor={`${resumo.temperaturaMinima}°C`}
                legenda={formatarDataHoraCurta(resumo.temperaturaMinimaHorario)}
              />
              <SummaryStatCard
                icone={Droplets}
                cor="var(--color-umidade)"
                rotulo="Umidade média"
                valor={`${resumo.umidadeMedia}%`}
                legenda={formatarLegendaComparativa(resumo.deltaUmidadeMedia, '%')}
                tendencia={
                  resumo.deltaUmidadeMedia == null
                    ? undefined
                    : resumo.deltaUmidadeMedia >= 0
                      ? 'alta'
                      : 'baixa'
                }
              />
            </div>
          ) : (
            <p className={styles.semDados}>Nenhuma leitura encontrada no período selecionado.</p>
          )}
        </section>

        <section className={styles.grid2Colunas}>
          <HistoryTable dias={diasComRotulo} />
          <TemperatureBarChart dados={diasComRotulo} />
        </section>

        <section className={styles.grid2Colunas}>
          <HumidityLineChart dados={diasComRotulo} />
          <MinMaxLineChart dados={diasComRotulo} />
        </section>

        <footer className={styles.rodape}>
          Dados em tempo real coletados pelo seu dispositivo
          <span className={styles.pontoRodape} />
        </footer>
      </div>
    </div>
  )
}

export default Dashboard
