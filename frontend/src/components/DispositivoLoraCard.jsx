import { Activity, Clock, Cpu, RefreshCw, SignalHigh } from 'lucide-react'
import styles from './DispositivoLoraCard.module.css'

// Depois de quanto tempo sem leitura o dispositivo é considerado offline —
// generoso o bastante acima do check-in de ~1 min da ESP32 pra não piscar
// "offline" por causa de um ciclo atrasado.
const LIMIAR_ONLINE_MS = 2 * 60 * 1000

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Um dispositivo LoRa (por enquanto só a ESP32_01, mas cada sensor_id novo
// que aparecer nas leituras vira um card aqui automaticamente — ver
// obterUltimaLeituraPorSensor em services/leiturasService.js).
function DispositivoLoraCard({ leitura, analisando, erroAnalise, onAnalisar }) {
  const { sensor_id: sensorId, data_hora: dataHora, dados_adicionais: dadosAdicionais } = leitura
  const online = Date.now() - new Date(dataHora).getTime() < LIMIAR_ONLINE_MS

  const rssiIda = dadosAdicionais?.rssi_ida
  const rssiVolta = dadosAdicionais?.rssi_volta
  const snrIda = dadosAdicionais?.snr_ida
  const snrVolta = dadosAdicionais?.snr_volta

  return (
    <div className={styles.card}>
      <div className={styles.topo}>
        <div className={styles.identificacao}>
          <div className={styles.iconeChip}>
            <Cpu size={20} />
          </div>
          <div>
            <div className={styles.nomeLinha}>
              <span className={styles.nome}>{sensorId}</span>
              <span className={`${styles.statusPill} ${online ? styles.statusOnline : styles.statusOffline}`}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            <span className={styles.subtexto}>Última leitura: {formatarDataHora(dataHora)}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.botaoAnalisar}
          onClick={onAnalisar}
          disabled={analisando}
        >
          <RefreshCw size={15} className={analisando ? styles.iconeGirando : undefined} />
          {analisando ? 'Aguardando o sensor…' : 'Analisar'}
        </button>
      </div>

      <div className={styles.metricas}>
        <div className={styles.metrica}>
          <div className={styles.metricaCabecalho}>
            <SignalHigh size={15} />
            <span>RSSI</span>
          </div>
          <span className={styles.metricaValor}>{rssiIda != null ? `${rssiIda} dBm` : '—'}</span>
        </div>

        <div className={styles.metrica}>
          <div className={styles.metricaCabecalho}>
            <Activity size={15} />
            <span>SNR</span>
          </div>
          <span className={styles.metricaValor}>{snrIda != null ? `${snrIda} dB` : '—'}</span>
        </div>

        {(rssiVolta != null || snrVolta != null) && (
          <div className={styles.metrica}>
            <div className={styles.metricaCabecalho}>
              <Clock size={15} />
              <span>Volta</span>
            </div>
            <span className={styles.metricaValor}>
              {rssiVolta != null ? `${rssiVolta} dBm` : '—'} · {snrVolta != null ? `${snrVolta} dB` : '—'}
            </span>
            <span className={styles.metricaRotuloNeutro}>Sentido rádio → ESP32</span>
          </div>
        )}
      </div>

      {erroAnalise && <p className={styles.erro}>{erroAnalise}</p>}
    </div>
  )
}

export default DispositivoLoraCard
