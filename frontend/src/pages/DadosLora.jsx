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

// Paciência da tela: depois disso sem resposta, o botão volta ao normal e
// avisa que falhou. Pedido explícito de manter em 30s, mesmo sabendo que o
// ciclo real do RX costuma levar 60-90s (às vezes 2 ciclos) — ou seja, é
// esperado que a mensagem de falha apareça com frequência mesmo quando o
// pedido ainda vai ser atendido segundos depois. O pedido em si vale mais
// tempo no backend (TEMPO_LIMITE_PENDENCIA, em api_rest/models.py, 5 min)
// — mesmo a tela desistindo aqui, o valor pode aparecer sozinho depois.
const TIMEOUT_ANALISE_MS = 30_000

// Quanto tempo a mensagem de falha fica visível antes de sumir sozinha.
const DURACAO_ERRO_MS = 3_000

// Página "Dados do LoRa": mostra, por dispositivo (sensor_id), a força do
// sinal do link LoRa (RSSI/SNR) sob demanda. Diferente da temperatura, que
// a ESP32 já envia sozinha a cada minuto, o RSSI só é consultado quando o
// usuário pede — daí o botão "Analisar" e a espera pelo próximo check-in.
function DadosLora() {
  const { tema, onAlternarTema } = useOutletContext()

  const [leituras, setLeituras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Uma analise pendente por sensor: sensorId -> { inicio }. Assim, clicar
  // "Analisar" num dispositivo nao mexe no estado dos outros.
  const [analisesPorSensor, setAnalisesPorSensor] = useState({})

  // Mensagens de falha são passageiras (ver DURACAO_ERRO_MS) e vivem
  // separadas de analisesPorSensor: assim que uma falha, o sensor já sai
  // de "pendente" (botão volta ao normal na hora), e a mensagem em si some
  // sozinha um pouco depois.
  const [errosTemporarios, setErrosTemporarios] = useState({})

  const { ocultosDesde, ocultarSensor } = useSensoresOcultos(CHAVE_OCULTOS, leituras)

  function mostrarErroTemporario(sensorId, mensagem) {
    setErrosTemporarios((atual) => ({ ...atual, [sensorId]: mensagem }))
    setTimeout(() => {
      setErrosTemporarios((atual) => {
        if (!(sensorId in atual)) return atual
        const proximo = { ...atual }
        delete proximo[sensorId]
        return proximo
      })
    }, DURACAO_ERRO_MS)
  }

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
  // ou estourou o tempo limite — nos dois casos, o sensor sai de "pendente"
  // (o botão volta ao normal na hora); no caso de timeout, mostra a
  // mensagem de falha por alguns segundos.
  useEffect(() => {
    if (sensoresPendentes.length === 0) return

    // Calculado aqui fora, a partir do estado atual — e não dentro do
    // updater do setAnalisesPorSensor logo abaixo, porque essa função pode
    // rodar depois deste trecho (não é síncrona), então "sensoresExpirados"
    // poderia ainda estar vazio na hora do forEach.
    const dispositivosAtuais = obterUltimaLeituraPorSensor(leituras)
    const agora = Date.now()
    const sensoresParaRemover = []
    const sensoresExpirados = []

    for (const sensorId of Object.keys(analisesPorSensor)) {
      const pedido = analisesPorSensor[sensorId]
      const dispositivo = dispositivosAtuais.find((d) => d.sensor_id === sensorId)
      const dataUltimaAnalise = dispositivo?.ultimaAnaliseRssi?.data_hora

      if (dataUltimaAnalise && new Date(dataUltimaAnalise).getTime() >= pedido.inicio) {
        sensoresParaRemover.push(sensorId)
      } else if (agora - pedido.inicio > TIMEOUT_ANALISE_MS) {
        sensoresParaRemover.push(sensorId)
        sensoresExpirados.push(sensorId)
      }
    }

    if (sensoresParaRemover.length > 0) {
      setAnalisesPorSensor((atual) => {
        const proximo = { ...atual }
        sensoresParaRemover.forEach((sensorId) => delete proximo[sensorId])
        return proximo
      })
    }

    sensoresExpirados.forEach((sensorId) => {
      mostrarErroTemporario(sensorId, 'O sensor não respondeu a tempo. Confira se ele está ligado e tente de novo.')
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
      [sensorId]: { inicio: Date.now() },
    }))

    try {
      await solicitarAnaliseRssi(sensorId)
    } catch {
      setAnalisesPorSensor((atual) => {
        const proximo = { ...atual }
        delete proximo[sensorId]
        return proximo
      })
      mostrarErroTemporario(sensorId, 'Não foi possível solicitar a análise. Tente novamente.')
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
              erroAnalise={errosTemporarios[leitura.sensor_id] ?? null}
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
