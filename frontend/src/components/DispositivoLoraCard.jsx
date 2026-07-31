import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Cpu, Radio, RefreshCw, SignalHigh } from 'lucide-react'
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

// Um dispositivo LoRa por sensor_id (cada ESP32 novo que aparecer nas
// leituras vira um card aqui automaticamente — ver obterUltimaLeituraPorSensor
// em services/leiturasService.js). O corpo com RSSI/SNR e configuração fica
// recolhido por padrão — só o essencial (nome, status, botão Analisar) fica
// sempre visível, pra a lista continuar legível com vários dispositivos.
function DispositivoLoraCard({ leitura, analisando, erroAnalise, onAnalisar }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)

  const { sensor_id: sensorId, data_hora: dataHora, ultimaAnaliseRssi, ultimaConfiguracao } = leitura
  const online = Date.now() - new Date(dataHora).getTime() < LIMIAR_ONLINE_MS
  const uidRemoto = ultimaConfiguracao?.dados_adicionais?.uid_remoto

  // O RSSI/SNR vêm da última análise feita (que pode ser de minutos atrás),
  // não da leitura mais recente — as leituras normais de temperatura, entre
  // uma análise e outra, não trazem esse dado.
  const dadosAdicionais = ultimaAnaliseRssi?.dados_adicionais
  const rssiIda = dadosAdicionais?.rssi_ida
  const rssiVolta = dadosAdicionais?.rssi_volta
  const snrIda = dadosAdicionais?.snr_ida
  const snrVolta = dadosAdicionais?.snr_volta

  // Ao clicar em "Analisar", abre os detalhes sozinho — sem isso, o
  // resultado chegaria escondido atrás do "Detalhes" fechado.
  useEffect(() => {
    if (analisando) setDetalhesAbertos(true)
  }, [analisando])

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

        <div className={styles.acoesTopo}>
          <button
            type="button"
            className={styles.botaoDetalhes}
            onClick={() => setDetalhesAbertos((aberto) => !aberto)}
          >
            {detalhesAbertos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes'}
          </button>

          <div className={styles.acaoAnalisar}>
            <button
              type="button"
              className={styles.botaoAnalisar}
              onClick={onAnalisar}
              disabled={analisando}
            >
              <RefreshCw size={15} className={analisando ? styles.iconeGirando : undefined} />
              {analisando ? 'Aguardando resposta…' : 'Analisar'}
            </button>
            {analisando && <span className={styles.dicaEspera}>Pode levar até 1 min</span>}
          </div>
        </div>
      </div>

      {erroAnalise && <p className={styles.erro}>{erroAnalise}</p>}

      {detalhesAbertos && (
        <div className={styles.detalhes}>
          <div className={styles.secaoTitulo}>
            <SignalHigh size={14} />
            <span>Qualidade do enlace</span>
          </div>

          <div className={styles.metricas}>
            <div className={styles.metrica}>
              <div className={styles.metricaCabecalho}>
                <SignalHigh size={13} />
                <span>RSSI · Ida</span>
              </div>
              <span className={styles.metricaValor}>{rssiIda != null ? `${rssiIda} dBm` : '—'}</span>
            </div>

            <div className={styles.metrica}>
              <div className={styles.metricaCabecalho}>
                <SignalHigh size={13} />
                <span>RSSI · Volta</span>
              </div>
              <span className={styles.metricaValor}>{rssiVolta != null ? `${rssiVolta} dBm` : '—'}</span>
            </div>

            <div className={styles.metrica}>
              <div className={styles.metricaCabecalho}>
                <Activity size={13} />
                <span>SNR · Ida</span>
              </div>
              <span className={styles.metricaValor}>{snrIda != null ? `${snrIda} dB` : '—'}</span>
            </div>

            <div className={styles.metrica}>
              <div className={styles.metricaCabecalho}>
                <Activity size={13} />
                <span>SNR · Volta</span>
              </div>
              <span className={styles.metricaValor}>{snrVolta != null ? `${snrVolta} dB` : '—'}</span>
            </div>
          </div>

          {ultimaAnaliseRssi && (
            <p className={styles.notaAnalise}>
              Última análise: {formatarDataHora(ultimaAnaliseRssi.data_hora)}
            </p>
          )}

          {uidRemoto && (
            <div className={styles.configuracao}>
              <div className={styles.secaoTitulo}>
                <Radio size={14} />
                <span>Configuração do dispositivo (Leitura remota 0xD4)</span>
              </div>

              <div className={styles.configuracaoGrid}>
                <div className={styles.configuracaoCampo}>
                  <span className={styles.configuracaoRotulo}>ID do rádio</span>
                  <span className={styles.configuracaoValor}>{uidRemoto}</span>
                </div>
              </div>

              <p className={styles.notaAnalise}>
                Lido em: {formatarDataHora(ultimaConfiguracao.data_hora)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DispositivoLoraCard
