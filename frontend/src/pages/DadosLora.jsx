import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Header from '../components/Header'
import StatusMessage from '../components/StatusMessage'
import DispositivoLoraCard from '../components/DispositivoLoraCard'
import {
  buscarLeituras,
  buscarStatusRssi,
  obterUltimaLeituraPorSensor,
  solicitarAnaliseRssi,
} from '../services/leiturasService'
import styles from './DadosLora.module.css'

// Mesmo ritmo de atualização automática do Dashboard, para a lista de
// dispositivos (e o status online/offline) se manter em dia sozinha.
const INTERVALO_ATUALIZACAO_MS = 60_000

// Enquanto espera a resposta de uma análise, confere com esse intervalo se
// o pedido pendente já foi atendido — não precisa ser rápido, já que o
// ESP32 só consulta o rádio uma vez por minuto.
const INTERVALO_POLL_ANALISE_MS = 5_000

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
  const [analisando, setAnalisando] = useState(false)
  const [erroAnalise, setErroAnalise] = useState(null)
  const inicioAnaliseRef = useRef(null)

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

  // Enquanto uma análise está pendente, confere periodicamente se a ESP32
  // já respondeu (o pedido deixa de estar pendente assim que uma leitura
  // chega com rssi_ida) — quando isso acontece, busca as leituras de novo
  // pra pegar o valor fresco.
  useEffect(() => {
    if (!analisando) return undefined

    const poll = setInterval(async () => {
      if (Date.now() - inicioAnaliseRef.current > TIMEOUT_ANALISE_MS) {
        setAnalisando(false)
        setErroAnalise('O sensor não respondeu a tempo. Confira se ele está ligado e tente de novo.')
        return
      }

      try {
        const pendente = await buscarStatusRssi()
        if (!pendente) {
          await carregarLeituras()
          setAnalisando(false)
        }
      } catch {
        // Falha pontual de rede durante o polling — a próxima tentativa,
        // alguns segundos depois, cobre isso.
      }
    }, INTERVALO_POLL_ANALISE_MS)

    return () => clearInterval(poll)
  }, [analisando])

  const dispositivos = useMemo(() => obterUltimaLeituraPorSensor(leituras), [leituras])

  async function aoClicarAnalisar() {
    setErroAnalise(null)
    setAnalisando(true)
    inicioAnaliseRef.current = Date.now()

    try {
      await solicitarAnaliseRssi()
    } catch {
      setAnalisando(false)
      setErroAnalise('Não foi possível solicitar a análise. Tente novamente.')
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

      {dispositivos.length === 0 ? (
        <p className={styles.semDados}>Nenhum dispositivo encontrado ainda.</p>
      ) : (
        <div className={styles.dispositivos}>
          {dispositivos.map((leitura) => (
            <DispositivoLoraCard
              key={leitura.sensor_id}
              leitura={leitura}
              analisando={analisando}
              erroAnalise={erroAnalise}
              onAnalisar={aoClicarAnalisar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DadosLora
