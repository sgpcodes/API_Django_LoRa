import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Header from '../components/Header'
import StatusMessage from '../components/StatusMessage'
import DispositivoLoraCard from '../components/DispositivoLoraCard'
import { useSensoresOcultos } from '../hooks/useSensoresOcultos'
import {
  buscarLeituras,
  obterUltimaLeituraPorSensor,
  solicitarAnaliseRssi,
} from '../services/leiturasService'
import styles from './DadosLora.module.css'

// Chave do localStorage onde ficam os dispositivos removidos manualmente
// desta página (ver hooks/useSensoresOcultos.js) — separada da usada na
// Visão Geral, pra remover um sensor aqui não escondê-lo lá.
const CHAVE_OCULTOS = 'lacop:dadosLora:sensoresOcultosDesde'

// Mesmo ritmo de atualização automática do Dashboard, para a lista de
// dispositivos (e o status online/offline) se manter em dia sozinha.
const INTERVALO_ATUALIZACAO_MS = 60_000

// Enquanto espera a resposta de uma análise, confere com esse intervalo se
// o pedido pendente já foi atendido. O gargalo real é o check-in da ESP32
// (~1 min), não esse polling — mas um intervalo curto evita atraso extra
// perceptível depois que a resposta já chegou.
const INTERVALO_POLL_ANALISE_MS = 2_500

// Se passar disso sem resposta, desiste e avisa o usuário (pode ser que o
// ESP32 esteja desligado/desconectado).
const TIMEOUT_ANALISE_MS = 100_000

// Página "Dados do LoRa": mostra, por dispositivo (sensor_id), a força do
// sinal do link LoRa (RSSI/SNR) sob demanda. Diferente da temperatura, que
// a ESP32 já envia sozinha a cada minuto, o RSSI só é consultado quando o
// usuário pede — daí o botão "Analisar" e a espera pelo próximo check-in.
function DadosLora() {
  const { tema, onAlternarTema } = useOutletContext()

  const [leituras, setLeituras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Uma analise pendente por sensor: sensorId -> { inicio, erro }. Assim,
  // clicar "Analisar" num dispositivo nao mexe no estado dos outros.
  const [analisesPorSensor, setAnalisesPorSensor] = useState({})

  const { ocultosDesde, ocultarSensor } = useSensoresOcultos(CHAVE_OCULTOS, leituras)

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

  useEffect(() => {
    carregarLeituras()
    const intervalo = setInterval(carregarLeituras, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  // Enquanto algum sensor tem análise pendente, confere periodicamente se
  // ele já respondeu — a resposta é detectada pela própria leitura (uma
  // análise nova de RSSI pra esse sensor, mais recente que o clique),
  // não pelo status global, já que vários sensores podem estar na fila.
  const sensoresPendentes = Object.keys(analisesPorSensor)

  useEffect(() => {
    if (sensoresPendentes.length === 0) return undefined

    const poll = setInterval(async () => {
      await carregarLeituras()
    }, INTERVALO_POLL_ANALISE_MS)

    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensoresPendentes.length])

  // Toda vez que leituras novas chegam, confere se alguma análise pendente
  // já foi respondida (leitura de RSSI mais recente que o inicio do pedido)
  // ou estourou o tempo limite.
  useEffect(() => {
    if (sensoresPendentes.length === 0) return

    const dispositivosAtuais = obterUltimaLeituraPorSensor(leituras)
    const agora = Date.now()

    setAnalisesPorSensor((atual) => {
      let mudou = false
      const proximo = { ...atual }

      for (const sensorId of Object.keys(atual)) {
        const pedido = atual[sensorId]
        const dispositivo = dispositivosAtuais.find((d) => d.sensor_id === sensorId)
        const dataUltimaAnalise = dispositivo?.ultimaAnaliseRssi?.data_hora

        if (dataUltimaAnalise && new Date(dataUltimaAnalise).getTime() >= pedido.inicio) {
          delete proximo[sensorId]
          mudou = true
        } else if (agora - pedido.inicio > TIMEOUT_ANALISE_MS && !pedido.erro) {
          proximo[sensorId] = {
            ...pedido,
            erro: 'O sensor não respondeu a tempo. Confira se ele está ligado e tente de novo.',
          }
          mudou = true
        }
      }

      return mudou ? proximo : atual
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leituras])

  const todosDispositivos = useMemo(() => obterUltimaLeituraPorSensor(leituras), [leituras])

  const dispositivos = useMemo(
    () => todosDispositivos.filter((dispositivo) => !(dispositivo.sensor_id in ocultosDesde)),
    [todosDispositivos, ocultosDesde]
  )

  async function aoClicarAnalisar(sensorId) {
    setAnalisesPorSensor((atual) => ({
      ...atual,
      [sensorId]: { inicio: Date.now(), erro: null },
    }))

    try {
      await solicitarAnaliseRssi(sensorId)
    } catch {
      setAnalisesPorSensor((atual) => ({
        ...atual,
        [sensorId]: { inicio: Date.now(), erro: 'Não foi possível solicitar a análise. Tente novamente.' },
      }))
    }
  }

  const cabecalho = (
    <Header
      titulo="Dados dos dispositivos LoRa"
      subtitulo="Consulte a qualidade do enlace de cada dispositivo, sob demanda."
      tema={tema}
      onAlternarTema={onAlternarTema}
    />
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando dispositivos..." />
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

  return (
    <div className={styles.pagina}>
      {cabecalho}

      {todosDispositivos.length === 0 ? (
        <p className={styles.semDados}>Nenhum dispositivo encontrado ainda.</p>
      ) : dispositivos.length === 0 ? (
        <p className={styles.semDados}>
          Todos os dispositivos foram removidos desta página. Eles reaparecem sozinhos assim que
          voltarem a enviar dados.
        </p>
      ) : (
        <div className={styles.dispositivos}>
          {dispositivos.map((leitura) => (
            <DispositivoLoraCard
              key={leitura.sensor_id}
              leitura={leitura}
              analisando={leitura.sensor_id in analisesPorSensor}
              erroAnalise={analisesPorSensor[leitura.sensor_id]?.erro ?? null}
              onAnalisar={() => aoClicarAnalisar(leitura.sensor_id)}
              onRemover={() => ocultarSensor(leitura.sensor_id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DadosLora
