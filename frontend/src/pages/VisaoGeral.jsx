import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Thermometer, ThermometerSun, ThermometerSnowflake, Droplets, Layers, Info } from 'lucide-react'
import Header from '../components/Header'
import StatusMessage from '../components/StatusMessage'
import SummaryStatCard from '../components/SummaryStatCard'
import ResumoSensoresTable from '../components/ResumoSensoresTable'
import MultiSensorLineChart from '../components/MultiSensorLineChart'
import SensorAtualBarChart from '../components/SensorAtualBarChart'
import { useSensoresOcultos } from '../hooks/useSensoresOcultos'
import {
  buscarLeituras,
  obterSensoresDisponiveis,
  obterIntervaloPeriodo,
  filtrarPorPeriodo,
  montarResumoGeral,
  montarResumoPorSensor,
  agruparMediaPorHoraPorSensor,
  corDoSensor,
  datasPersonalizadasIniciais,
} from '../services/leiturasService'
import styles from './VisaoGeral.module.css'

// Mesmo ritmo das outras páginas — a ESP32 envia uma leitura por minuto.
const INTERVALO_ATUALIZACAO_MS = 60_000

// Chave do localStorage onde ficam os sensores removidos manualmente desta
// página (ver hooks/useSensoresOcultos.js). Uma chave por página: remover
// um sensor aqui não esconde ele na página de Dados do LoRa.
const CHAVE_OCULTOS = 'lacop:visaoGeral:sensoresOcultosDesde'

const ROTULOS_PERIODO = {
  hoje: 'hoje',
  ontem: 'ontem',
  '7dias': 'os últimos 7 dias',
  '30dias': 'os últimos 30 dias',
  personalizado: 'o período selecionado',
}

function formatarHorario(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Página "Visão Geral": todos os ESPs de uma vez só, lado a lado — enquanto
// o Dashboard foca em um dispositivo por vez. A lista de sensores vem dos
// dados (ver obterSensoresDisponiveis), então um ESP32 novo aparece aqui
// sozinho assim que a primeira leitura dele chegar; nenhuma configuração
// manual de "quais sensores existem" é necessária.
function VisaoGeral() {
  const { tema, onAlternarTema } = useOutletContext()

  const [leituras, setLeituras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')
  const [datasPersonalizadas, setDatasPersonalizadas] = useState(datasPersonalizadasIniciais)
  const { ocultosDesde, ocultarSensor } = useSensoresOcultos(CHAVE_OCULTOS, leituras)

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

  const sensoresDisponiveis = useMemo(() => obterSensoresDisponiveis(leituras), [leituras])

  const sensoresVisiveis = useMemo(
    () => sensoresDisponiveis.filter((sensorId) => !(sensorId in ocultosDesde)),
    [sensoresDisponiveis, ocultosDesde]
  )

  const leiturasVisiveis = useMemo(
    () => leituras.filter((leitura) => sensoresVisiveis.includes(leitura.sensor_id)),
    [leituras, sensoresVisiveis]
  )

  const intervaloSelecionado = useMemo(
    () => obterIntervaloPeriodo(periodo, datasPersonalizadas),
    [periodo, datasPersonalizadas]
  )

  const leiturasDoPeriodo = useMemo(
    () => filtrarPorPeriodo(leiturasVisiveis, intervaloSelecionado),
    [leiturasVisiveis, intervaloSelecionado]
  )

  const resumoGeral = useMemo(() => montarResumoGeral(leiturasDoPeriodo), [leiturasDoPeriodo])

  const linhasResumo = useMemo(() => {
    const linhas = montarResumoPorSensor(leiturasVisiveis, leiturasDoPeriodo)
    return linhas.map((linha) => ({ ...linha, cor: corDoSensor(sensoresVisiveis, linha.sensorId) }))
  }, [leiturasVisiveis, leiturasDoPeriodo, sensoresVisiveis])

  const coresVisiveis = useMemo(
    () => sensoresVisiveis.map((sensorId) => corDoSensor(sensoresVisiveis, sensorId)),
    [sensoresVisiveis]
  )

  const dadosTemperaturaPorHora = useMemo(
    () => agruparMediaPorHoraPorSensor(leiturasDoPeriodo, sensoresVisiveis, 'temperatura'),
    [leiturasDoPeriodo, sensoresVisiveis]
  )

  const dadosUmidadePorHora = useMemo(
    () => agruparMediaPorHoraPorSensor(leiturasDoPeriodo, sensoresVisiveis, 'umidade'),
    [leiturasDoPeriodo, sensoresVisiveis]
  )

  const dadosBarraAtual = useMemo(
    () => linhasResumo.map((linha) => ({ sensorId: linha.sensorId, valor: linha.temperaturaAtual, cor: linha.cor })),
    [linhasResumo]
  )

  const totalSensores = sensoresVisiveis.length
  const sensoresOnline = linhasResumo.filter((linha) => linha.online).length
  const rotuloPeriodo = ROTULOS_PERIODO[periodo] ?? 'hoje'

  const cabecalho = (
    <Header
      titulo="Visão geral de todos os sensores"
      subtitulo="Acompanhe em tempo real os dados coletados por todos os ESPs."
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
        <StatusMessage texto="Carregando visão geral..." />
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

  if (sensoresDisponiveis.length === 0) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Nenhum sensor encontrado ainda." />
      </div>
    )
  }

  if (sensoresVisiveis.length === 0) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Todos os sensores foram removidos desta visão. Eles reaparecem sozinhos assim que voltarem a enviar dados." />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      {cabecalho}

      <div className={styles.cardsPrincipais}>
        <SummaryStatCard
          icone={Thermometer}
          cor="var(--color-media)"
          rotulo="Temperatura média geral"
          valor={resumoGeral ? `${resumoGeral.temperaturaMedia}°C` : '—'}
          legenda={`Média das ${totalSensores} ESPs`}
        />
        <SummaryStatCard
          icone={Droplets}
          cor="var(--color-umidade)"
          rotulo="Umidade média geral"
          valor={resumoGeral ? `${resumoGeral.umidadeMedia}%` : '—'}
          legenda={`Média das ${totalSensores} ESPs`}
        />
        <SummaryStatCard
          icone={ThermometerSun}
          cor="var(--color-maxima)"
          rotulo={`Temperatura máxima (${rotuloPeriodo})`}
          valor={resumoGeral ? `${resumoGeral.temperaturaMaxima}°C` : '—'}
          legenda={
            resumoGeral
              ? `Registrada por ${resumoGeral.temperaturaMaximaSensor} às ${formatarHorario(resumoGeral.temperaturaMaximaHorario)}`
              : 'Sem leituras no período selecionado'
          }
        />
        <SummaryStatCard
          icone={ThermometerSnowflake}
          cor="var(--color-minima)"
          rotulo={`Temperatura mínima (${rotuloPeriodo})`}
          valor={resumoGeral ? `${resumoGeral.temperaturaMinima}°C` : '—'}
          legenda={
            resumoGeral
              ? `Registrada por ${resumoGeral.temperaturaMinimaSensor} às ${formatarHorario(resumoGeral.temperaturaMinimaHorario)}`
              : 'Sem leituras no período selecionado'
          }
        />
        <SummaryStatCard
          icone={Layers}
          cor="#7c3aed"
          rotulo="Sensores ativos"
          valor={`${sensoresOnline}`}
          legenda={`De ${totalSensores} sensores`}
          progresso={totalSensores ? (sensoresOnline / totalSensores) * 100 : 0}
        />
      </div>

      <ResumoSensoresTable
        titulo={`Resumo por sensor (atualizado em ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`}
        linhas={linhasResumo}
        onRemover={ocultarSensor}
      />

      <section className={styles.grid3Colunas}>
        <MultiSensorLineChart
          titulo="Temperatura média por hora (todos os sensores)"
          icone={Thermometer}
          dados={dadosTemperaturaPorHora}
          sensores={sensoresVisiveis}
          cores={coresVisiveis}
          unidade="°C"
        />
        <MultiSensorLineChart
          titulo="Umidade média por hora (todos os sensores)"
          icone={Droplets}
          dados={dadosUmidadePorHora}
          sensores={sensoresVisiveis}
          cores={coresVisiveis}
          unidade="%"
        />
        <SensorAtualBarChart titulo="Temperatura atual por sensor" dados={dadosBarraAtual} unidade="°C" />
      </section>

      <p className={styles.notaRodape}>
        <Info size={14} />
        Dados atualizados automaticamente a cada 1 minuto.
      </p>
    </div>
  )
}

export default VisaoGeral
