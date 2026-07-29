import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Cpu, Clock, Thermometer, ThermometerSun, ThermometerSnowflake, Droplets } from 'lucide-react'
import Header from '../components/Header'
import WeatherChart from '../components/WeatherChart'
import StatusMessage from '../components/StatusMessage'
import SummaryStatCard from '../components/SummaryStatCard'
import HistoryTable from '../components/HistoryTable'
import TemperatureBarChart from '../components/TemperatureBarChart'
import HumidityLineChart from '../components/HumidityLineChart'
import MinMaxLineChart from '../components/MinMaxLineChart'
import {
  buscarLeituras,
  agruparMediaPorHora,
  obterLeituraMaisRecente,
  obterIntervaloPeriodo,
  obterIntervaloAnterior,
  filtrarPorPeriodo,
  agruparPorDia,
  calcularResumo,
} from '../services/leiturasService'
import styles from './Dashboard.module.css'

// Busca novas leituras periodicamente para o dashboard se manter atualizado
// sozinho. A ESP32 envia uma leitura a cada 1 minuto, então buscamos nesse
// ritmo para os cards e os gráficos acompanharem cada leitura nova assim
// que ela chegar.
const INTERVALO_ATUALIZACAO_MS = 60_000

function formatarHorario(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarDataCurta(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleDateString('pt-BR')
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
  const { tema, onAlternarTema } = useOutletContext()

  const [leituras, setLeituras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')
  const [datasPersonalizadas, setDatasPersonalizadas] = useState(datasPersonalizadasIniciais)

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

  const leituraAtual = useMemo(() => obterLeituraMaisRecente(leituras), [leituras])

  const intervaloSelecionado = useMemo(
    () => obterIntervaloPeriodo(periodo, datasPersonalizadas),
    [periodo, datasPersonalizadas]
  )

  const dadosGraficoPorHora = useMemo(() => {
    const leiturasDoPeriodo = filtrarPorPeriodo(leituras, intervaloSelecionado)
    return agruparMediaPorHora(leiturasDoPeriodo)
  }, [leituras, intervaloSelecionado])

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

  const cabecalho = (
    <Header
      periodo={periodo}
      onEscolherPeriodo={setPeriodo}
      dataInicio={datasPersonalizadas.inicio}
      dataFim={datasPersonalizadas.fim}
      onAplicarPersonalizado={(inicio, fim) => {
        setDatasPersonalizadas({ inicio, fim })
        setPeriodo('personalizado')
      }}
      tema={tema}
      onAlternarTema={onAlternarTema}
    />
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando dados do clima..." />
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

  if (!leituraAtual) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Nenhuma leitura cadastrada ainda." />
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
          rotulo="Temperatura média"
          valor={resumo ? `${resumo.temperaturaMedia}°C` : '—'}
          legenda={
            resumo
              ? formatarLegendaComparativa(resumo.deltaTemperaturaMedia, '°C')
              : 'Sem leituras no período selecionado'
          }
          tendencia={
            resumo?.deltaTemperaturaMedia == null
              ? undefined
              : resumo.deltaTemperaturaMedia >= 0
                ? 'alta'
                : 'baixa'
          }
        />
        <SummaryStatCard
          icone={Droplets}
          cor="var(--color-accent)"
          rotulo="Umidade média"
          valor={resumo ? `${resumo.umidadeMedia}%` : '—'}
          legenda={
            resumo
              ? formatarLegendaComparativa(resumo.deltaUmidadeMedia, '%')
              : 'Sem leituras no período selecionado'
          }
          tendencia={
            resumo?.deltaUmidadeMedia == null
              ? undefined
              : resumo.deltaUmidadeMedia >= 0
                ? 'alta'
                : 'baixa'
          }
        />
        <SummaryStatCard
          icone={Cpu}
          cor="var(--color-accent)"
          rotulo="Sensor"
          valor={leituraAtual.sensor_id}
          legenda={`Última atualização: ${formatarHorario(leituraAtual.data_hora)}`}
        />
        <SummaryStatCard
          icone={Clock}
          cor="var(--color-accent)"
          rotulo="Última atualização"
          valor={formatarHorario(leituraAtual.data_hora)}
          legenda={formatarDataCurta(leituraAtual.data_hora)}
        />
      </div>

      <section className={styles.grid2Colunas}>
        <WeatherChart dados={dadosGraficoPorHora} />
        <TemperatureBarChart dados={diasComRotulo} />
      </section>

      {resumo ? (
        <section className={styles.resumoGrid}>
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
        </section>
      ) : (
        <p className={styles.semDados}>Nenhuma leitura encontrada no período selecionado.</p>
      )}

      <section className={styles.grid2Colunas}>
        <HistoryTable dias={diasComRotulo} />
        <MinMaxLineChart dados={diasComRotulo} />
      </section>

      <section className={styles.grid1Coluna}>
        <HumidityLineChart dados={diasComRotulo} />
      </section>
    </div>
  )
}

export default Dashboard
