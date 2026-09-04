import { useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Cpu, Pencil, Radio, SignalHigh, Trash2, UserRound, X } from 'lucide-react'
import { estaOnline } from '../services/leiturasService'
import styles from './DispositivoLoraCard.module.css'
import adminStyles from './EstacaoAdminCard.module.css'

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Card de uma estação na tela de Estações do admin: mesmo padrão visual
// de DispositivoLoraCard (Dados do LoRa) — recolhido por padrão, "Detalhes"
// abre RSSI/SNR/configuração do rádio — só que somando quem é o dono da
// estação (ou "Sem dono", pros sensores que já mandam leitura mas ainda
// não foram cadastrados/atribuídos a ninguém).
function EstacaoAdminCard({ dispositivo, contas = [], processando, erro, onTrocarDono, onRemover, onSalvarEdicao }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [novoDono, setNovoDono] = useState('')
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState(null)

  const {
    sensor_id: sensorId,
    data_hora: dataHora,
    estacaoId,
    donoId,
    donoNome,
    nome,
    intervaloEnvioMinutos,
    limiteOfflineMinutos,
    ativa,
    ultimaAnaliseRssi,
    ultimaConfiguracao,
  } = dispositivo
  const online = estaOnline(dataHora)
  const uidRemoto = ultimaConfiguracao?.dados_adicionais?.uid_remoto

  const dadosAdicionais = ultimaAnaliseRssi?.dados_adicionais
  const rssiIda = dadosAdicionais?.rssi_ida
  const rssiVolta = dadosAdicionais?.rssi_volta
  const snrIda = dadosAdicionais?.snr_ida
  const snrVolta = dadosAdicionais?.snr_volta

  const configRF = ultimaConfiguracao?.dados_adicionais
  const potenciaDbm = configRF?.potencia_dbm
  const frequenciaMhz = configRF?.frequencia_mhz
  const bandwidthKhz = configRF?.bandwidth_khz
  const spreadingFactor = configRF?.spreading_factor
  const codingRate = configRF?.coding_rate
  const versaoFw = configRF?.versao_fw

  function abrirEdicao() {
    setCampos({
      nome: nome ?? '',
      intervalo_envio_minutos: intervaloEnvioMinutos ?? 10,
      limite_offline_minutos: limiteOfflineMinutos ?? 30,
      ativa: ativa ?? true,
    })
    setEditando(true)
    setDetalhesAbertos(true)
  }

  async function salvarEdicao(evento) {
    evento.preventDefault()
    const sucesso = await onSalvarEdicao(campos)
    if (sucesso) setEditando(false)
  }

  return (
    <div className={styles.card}>
      <div className={styles.topo}>
        <div className={styles.identificacao}>
          <div className={styles.iconeChip}>
            <Cpu size={20} />
          </div>
          <div>
            <div className={styles.nomeLinha}>
              <span className={styles.nome}>{nome || sensorId}</span>
              <span className={`${styles.statusPill} ${online ? styles.statusOnline : styles.statusOffline}`}>
                {online ? 'Online' : 'Offline'}
              </span>
              {ativa === false && <span className={adminStyles.semDonoPill}>Inativa</span>}
              {donoNome ? (
                <span className={adminStyles.donoPill}>
                  <UserRound size={11} />
                  {donoNome}
                </span>
              ) : (
                <span className={adminStyles.semDonoPill}>Sem dono</span>
              )}
            </div>
            <span className={styles.subtexto}>
              {sensorId} · Última leitura: {formatarDataHora(dataHora)}
            </span>
          </div>
        </div>

        <div className={styles.acoesTopo}>
          {estacaoId != null && (
            <button
              type="button"
              className={styles.botaoDetalhes}
              onClick={abrirEdicao}
              disabled={processando}
              title="Editar estação"
            >
              <Pencil size={14} />
            </button>
          )}

          {estacaoId != null && (
            <button
              type="button"
              className={styles.botaoRemover}
              onClick={() => {
                if (window.confirm(`Remover a estação "${nome || sensorId}"? O histórico de leituras é mantido.`)) {
                  onRemover()
                }
              }}
              disabled={processando}
              title="Remover estação"
              aria-label={`Remover ${sensorId}`}
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
        </div>
      </div>

      {detalhesAbertos && (
        <div className={styles.detalhes}>
          {editando && campos && (
            <form className={adminStyles.formEdicao} onSubmit={salvarEdicao}>
              <div className={adminStyles.gradeEdicao}>
                <label className={adminStyles.campoEdicao}>
                  <span className={styles.configuracaoRotulo}>Nome</span>
                  <input
                    className={adminStyles.input}
                    value={campos.nome}
                    placeholder={sensorId}
                    onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
                  />
                </label>
                <label className={adminStyles.campoEdicao}>
                  <span className={styles.configuracaoRotulo}>Intervalo de envio</span>
                  <select
                    className={adminStyles.input}
                    value={campos.intervalo_envio_minutos}
                    onChange={(e) => setCampos((c) => ({ ...c, intervalo_envio_minutos: Number(e.target.value) }))}
                  >
                    <option value={5}>5 minutos</option>
                    <option value={10}>10 minutos</option>
                    <option value={15}>15 minutos</option>
                  </select>
                </label>
                <label className={adminStyles.campoEdicao}>
                  <span className={styles.configuracaoRotulo}>Limite offline (min)</span>
                  <input
                    className={adminStyles.input}
                    type="number"
                    min={1}
                    value={campos.limite_offline_minutos}
                    onChange={(e) => setCampos((c) => ({ ...c, limite_offline_minutos: Number(e.target.value) }))}
                  />
                </label>
                <label className={adminStyles.campoEdicaoCheckbox}>
                  <input
                    type="checkbox"
                    checked={campos.ativa}
                    onChange={(e) => setCampos((c) => ({ ...c, ativa: e.target.checked }))}
                  />
                  <span className={styles.configuracaoRotulo}>Estação ativa</span>
                </label>
              </div>
              <div className={adminStyles.linhaTrocarDono}>
                <button type="submit" className={adminStyles.botaoTrocar} disabled={processando}>
                  {processando ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" className={styles.botaoDetalhes} onClick={() => setEditando(false)}>
                  <X size={14} /> Cancelar
                </button>
              </div>
              {erro && <p className={adminStyles.aviso}>{erro}</p>}
            </form>
          )}

          {!editando && (
            <>
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

              <p className={styles.notaAnalise}>Lido em: {formatarDataHora(ultimaConfiguracao.data_hora)}</p>
            </div>
          )}

          {estacaoId != null && (
            <div className={adminStyles.gerenciar}>
              <div className={styles.secaoTitulo}>
                <UserRound size={14} />
                <span>Trocar dono</span>
              </div>
              <div className={adminStyles.linhaTrocarDono}>
                <select
                  className={adminStyles.seletor}
                  value={novoDono}
                  onChange={(evento) => setNovoDono(evento.target.value)}
                  disabled={processando}
                >
                  <option value="">Selecione uma conta...</option>
                  {contas
                    .filter((conta) => conta.id !== donoId)
                    .map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {conta.first_name || conta.username} ({conta.plano_atual ?? 'sem plano'})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className={adminStyles.botaoTrocar}
                  disabled={!novoDono || processando}
                  onClick={() => {
                    onTrocarDono(novoDono)
                    setNovoDono('')
                  }}
                >
                  {processando ? 'Trocando...' : 'Trocar'}
                </button>
              </div>
              {erro && <p className={adminStyles.aviso}>{erro}</p>}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default EstacaoAdminCard
