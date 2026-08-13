import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Cpu, Radio, RefreshCw, SignalHigh, Trash2 } from 'lucide-react'
import { estaOnline } from '../services/leiturasService'
import styles from './DispositivoLoraCard.module.css'

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// "agora", "há 1 min", "há 2 min"... Usado na dica de última leitura de
// RSSI, que fica sempre visível — precisão de segundos ali só atrapalharia.
function formatarTempoRelativo(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos <= 0) return 'agora'
  return `há ${minutos} min`
}

// Um dispositivo LoRa por sensor_id (cada ESP32 novo que aparecer nas
// leituras vira um card aqui automaticamente — ver obterUltimaLeituraPorSensor
// em services/leiturasService.js). O corpo com RSSI/SNR e configuração fica
// recolhido por padrão — só o essencial (nome, status, botão Analisar) fica
// sempre visível, pra a lista continuar legível com vários dispositivos.
function DispositivoLoraCard({ leitura, analisando, erroAnalise, onAnalisar, onRemover }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)

  const { sensor_id: sensorId, data_hora: dataHora, ultimaAnaliseRssi, ultimaConfiguracao } = leitura
  const online = estaOnline(dataHora)
  const uidRemoto = ultimaConfiguracao?.dados_adicionais?.uid_remoto

  // O RSSI/SNR vêm da última análise feita (que pode ser de minutos atrás),
  // não da leitura mais recente — as leituras normais de temperatura, entre
  // uma análise e outra, não trazem esse dado.
  const dadosAdicionais = ultimaAnaliseRssi?.dados_adicionais
  const rssiIda = dadosAdicionais?.rssi_ida
  const rssiVolta = dadosAdicionais?.rssi_volta
  const snrIda = dadosAdicionais?.snr_ida
  const snrVolta = dadosAdicionais?.snr_volta

  // Parametros de RF (potencia/banda/BW/SF/CR/versão), lidos uma vez via
  // comando 0xD6 — mesmo "retrato congelado" do uid_remoto, todos chegam
  // juntos na mesma leitura na maioria das vezes. frequenciaMhz e versaoFw
  // são campos novos: dispositivos que ainda não mandam esses dados
  // simplesmente não mostram esses dois campos (checagem "!= null" abaixo).
  const configRF = ultimaConfiguracao?.dados_adicionais
  const potenciaDbm = configRF?.potencia_dbm
  const frequenciaMhz = configRF?.frequencia_mhz
  const bandwidthKhz = configRF?.bandwidth_khz
  const spreadingFactor = configRF?.spreading_factor
  const codingRate = configRF?.coding_rate
  const versaoFw = configRF?.versao_fw

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
          {!online && (
            <button
              type="button"
              className={styles.botaoRemover}
              onClick={onRemover}
              title="Remover da lista (dispositivo inativo)"
              aria-label={`Remover ${sensorId} da lista`}
            >
              <Trash2 size={15} />
            </button>
          )}

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
            <span className={styles.dicaEspera}>
              {ultimaAnaliseRssi
                ? `Última leitura de RSSI: ${formatarTempoRelativo(ultimaAnaliseRssi.data_hora)}`
                : 'Nenhuma leitura de RSSI ainda'}
            </span>
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

          {(uidRemoto || potenciaDbm != null || frequenciaMhz != null || versaoFw != null) && (
            <div className={styles.configuracao}>
              <div className={styles.secaoTitulo}>
                <Radio size={14} />
                <span>Configuração do dispositivo</span>
              </div>

              <div className={styles.configuracaoGrid}>
                {uidRemoto && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>ID do rádio</span>
                    <span className={styles.configuracaoValor}>{uidRemoto}</span>
                  </div>
                )}

                {potenciaDbm != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>Potência</span>
                    <span className={styles.configuracaoValor}>{potenciaDbm} dBm</span>
                  </div>
                )}

                {frequenciaMhz != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>Banda</span>
                    <span className={styles.configuracaoValor}>{frequenciaMhz} MHz</span>
                  </div>
                )}

                {bandwidthKhz != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>BW</span>
                    <span className={styles.configuracaoValor}>{bandwidthKhz} kHz</span>
                  </div>
                )}

                {spreadingFactor != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>Spreading Factor</span>
                    <span className={styles.configuracaoValor}>
                      {spreadingFactor === 0 ? 'FSK' : `SF${spreadingFactor}`}
                    </span>
                  </div>
                )}

                {codingRate != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>Coding Rate</span>
                    <span className={styles.configuracaoValor}>{codingRate}</span>
                  </div>
                )}

                {versaoFw != null && (
                  <div className={styles.configuracaoCampo}>
                    <span className={styles.configuracaoRotulo}>Versão FW</span>
                    <span className={styles.configuracaoValor}>{versaoFw}</span>
                  </div>
                )}
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
