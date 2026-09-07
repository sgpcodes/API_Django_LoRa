import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BatteryMedium,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Droplets,
  Gauge,
  MapPin,
  MoreVertical,
  Pencil,
  Radio,
  RefreshCw,
  SignalHigh,
  Thermometer,
  Trash2,
  UserRound,
  Wind,
  X,
} from 'lucide-react'
import { estaOnline, solicitarAnaliseRssi } from '../services/leiturasService'
import styles from './DispositivoLoraCard.module.css'
import adminStyles from './EstacaoAdminCard.module.css'

function formatarDataHora(iso) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function seloDelta(delta, unidade) {
  if (delta == null || delta === 0) return null
  const positivo = delta > 0
  return (
    <span className={`${adminStyles.delta} ${positivo ? adminStyles.deltaAlta : adminStyles.deltaBaixa}`}>
      {positivo ? '↑' : '↓'} {Math.abs(delta)}
      {unidade}
    </span>
  )
}

// Card de uma estação na tela de Estações do admin: cabeçalho (nome,
// status, plano do dono, localização) + dados atuais da estação
// (temperatura/umidade/vento/pressão — vento fica "—" até existir
// hardware que meça isso de verdade), qualidade do enlace LoRa, status
// do dispositivo e configurações. "Ver detalhes" abre a configuração de
// rádio (RSSI/SNR só de uma análise específica, ID do rádio etc.).
function EstacaoAdminCard({ dispositivo, contas = [], processando, erro, onTrocarDono, onRemover, onSalvarEdicao }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [trocandoDono, setTrocandoDono] = useState(false)
  const [novoDono, setNovoDono] = useState('')
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState(null)
  const [analisando, setAnalisando] = useState(false)
  const [avisoAnalise, setAvisoAnalise] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    function aoClicarFora(evento) {
      if (menuRef.current && !menuRef.current.contains(evento.target)) setMenuAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const {
    sensor_id: sensorId,
    data_hora: dataHora,
    estacaoId,
    donoId,
    donoNome,
    donoPlano,
    nome,
    localizacao,
    intervaloEnvioMinutos,
    limiteOfflineMinutos,
    ativa,
    temperatura,
    umidade,
    pressao,
    deltaTemperatura,
    deltaUmidade,
    deltaPressao,
    ultimaAnaliseRssi,
    ultimaConfiguracao,
  } = dispositivo
  const online = Boolean(dataHora) && estaOnline(dataHora)
  const uidRemoto = ultimaConfiguracao?.dados_adicionais?.uid_remoto
  const velocidadeVento = dispositivo.dados_adicionais?.velocidade_vento
  const direcaoVento = dispositivo.dados_adicionais?.direcao_vento

  const dadosAdicionais = ultimaAnaliseRssi?.dados_adicionais
  const rssiIda = dadosAdicionais?.rssi_ida
  const rssiVolta = dadosAdicionais?.rssi_volta
  const snrIda = dadosAdicionais?.snr_ida
  const snrVolta = dadosAdicionais?.snr_volta
  const rssiAtualizado = ultimaAnaliseRssi != null

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
      localizacao: localizacao ?? '',
      intervalo_envio_minutos: intervaloEnvioMinutos ?? 10,
      limite_offline_minutos: limiteOfflineMinutos ?? 30,
      ativa: ativa ?? true,
    })
    setEditando(true)
    setMenuAberto(false)
  }

  async function salvarEdicao(evento) {
    evento.preventDefault()
    const sucesso = await onSalvarEdicao(campos)
    if (sucesso) setEditando(false)
  }

  async function aoAtualizarRssi() {
    setAnalisando(true)
    setAvisoAnalise('')
    try {
      await solicitarAnaliseRssi(sensorId)
      setAvisoAnalise('Solicitado — o resultado chega na próxima leitura do dispositivo.')
    } catch {
      setAvisoAnalise('Não foi possível solicitar agora. Tente de novo.')
    } finally {
      setAnalisando(false)
    }
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
              {donoPlano && <span className={adminStyles.planoPill}>{donoPlano}</span>}
            </div>
            <span className={styles.subtexto}>
              {sensorId} · Última leitura: {formatarDataHora(dataHora)}
            </span>
            {localizacao && (
              <span className={adminStyles.localizacao}>
                <MapPin size={12} />
                {localizacao}
              </span>
            )}
          </div>
        </div>

        <div className={styles.acoesTopo}>
          <button
            type="button"
            className={styles.botaoDetalhes}
            onClick={() => setDetalhesAbertos((aberto) => !aberto)}
          >
            {detalhesAbertos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {detalhesAbertos ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          {estacaoId != null && (
            <div className={adminStyles.menuWrapper} ref={menuRef}>
              <button
                type="button"
                className={styles.botaoRemover}
                onClick={() => setMenuAberto((a) => !a)}
                aria-label="Mais ações"
                disabled={processando}
              >
                <MoreVertical size={16} />
              </button>
              {menuAberto && (
                <div className={adminStyles.menuDropdown}>
                  <button type="button" className={adminStyles.menuItem} onClick={abrirEdicao}>
                    <Pencil size={14} /> Configurações
                  </button>
                  <button
                    type="button"
                    className={adminStyles.menuItem}
                    onClick={() => {
                      setMenuAberto(false)
                      setTrocandoDono(true)
                      setDetalhesAbertos(true)
                    }}
                  >
                    <UserRound size={14} /> Trocar dono
                  </button>
                  <button
                    type="button"
                    className={`${adminStyles.menuItem} ${adminStyles.menuItemPerigo}`}
                    onClick={() => {
                      setMenuAberto(false)
                      if (window.confirm(`Excluir a estação "${nome || sensorId}"? O histórico de leituras é mantido.`)) {
                        onRemover()
                      }
                    }}
                  >
                    <Trash2 size={14} /> Excluir estação
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={adminStyles.secaoDados}>
        <div className={styles.secaoTitulo}>
          <Radio size={14} />
          <span>Dados da estação (LoRa)</span>
        </div>
        <div className={adminStyles.grideDados}>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Thermometer size={14} className={adminStyles.iconeTemperatura} />
              <span>Temperatura</span>
            </div>
            <span className={adminStyles.tileValor}>{temperatura != null ? `${temperatura} °C` : '—'}</span>
            {seloDelta(deltaTemperatura, ' °C')}
          </div>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Droplets size={14} className={adminStyles.iconeUmidade} />
              <span>Umidade</span>
            </div>
            <span className={adminStyles.tileValor}>{umidade != null ? `${umidade}%` : '—'}</span>
            {seloDelta(deltaUmidade, '%')}
          </div>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Wind size={14} className={adminStyles.iconeVento} />
              <span>Velocidade do vento</span>
            </div>
            <span className={adminStyles.tileValor}>{velocidadeVento != null ? `${velocidadeVento} km/h` : '—'}</span>
          </div>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Compass size={14} className={adminStyles.iconeDirecao} />
              <span>Direção do vento</span>
            </div>
            <span className={adminStyles.tileValor}>{direcaoVento != null ? `${direcaoVento}°` : '—'}</span>
          </div>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Gauge size={14} className={adminStyles.iconePressao} />
              <span>Pressão atmosférica</span>
            </div>
            <span className={adminStyles.tileValor}>{pressao != null ? `${pressao} hPa` : '—'}</span>
            {seloDelta(deltaPressao, ' hPa')}
          </div>
        </div>
      </div>

      {detalhesAbertos && (
        <div className={styles.detalhes}>
          {editando && campos ? (
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
                  <span className={styles.configuracaoRotulo}>Localização</span>
                  <input
                    className={adminStyles.input}
                    value={campos.localizacao}
                    placeholder="Ex.: Área de Plantio - Talhão 2"
                    onChange={(e) => setCampos((c) => ({ ...c, localizacao: e.target.value }))}
                  />
                </label>
                <label className={adminStyles.campoEdicao}>
                  <span className={styles.configuracaoRotulo}>Frequência de leitura</span>
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
          ) : (
            <>
              <div className={adminStyles.linhaSecoes}>
                <div className={adminStyles.blocoStatus}>
                  <div className={styles.secaoTitulo}>
                    <Activity size={14} />
                    <span>Status do dispositivo</span>
                  </div>
                  <div className={adminStyles.statusLista}>
                    <div className={adminStyles.statusItem}>
                      <span className={styles.configuracaoRotulo}>Status</span>
                      <span className={`${adminStyles.statusValor} ${online ? adminStyles.statusOk : adminStyles.statusRuim}`}>
                        {online ? <Check size={13} /> : null}
                        {online ? 'Operacional' : 'Desconectado'}
                      </span>
                    </div>
                    <div className={adminStyles.statusItem}>
                      <span className={styles.configuracaoRotulo}>RSSI</span>
                      <span className={styles.configuracaoValor}>{rssiAtualizado ? 'Atualizado' : 'Não atualizado'}</span>
                    </div>
                    <div className={adminStyles.statusItem}>
                      <span className={styles.configuracaoRotulo}>
                        <BatteryMedium size={12} /> Bateria
                      </span>
                      <span className={styles.configuracaoValor} title="Firmware atual não envia esse dado ainda">
                        —
                      </span>
                    </div>
                  </div>
                </div>

                <div className={adminStyles.blocoStatus}>
                  <div className={styles.secaoTitulo}>
                    <Cpu size={14} />
                    <span>Configurações</span>
                  </div>
                  <div className={adminStyles.statusLista}>
                    <div className={adminStyles.statusItem}>
                      <span className={styles.configuracaoRotulo}>Frequência de leitura</span>
                      <span className={styles.configuracaoValor}>{intervaloEnvioMinutos ?? '—'} min</span>
                    </div>
                    <div className={adminStyles.statusItem}>
                      <span className={styles.configuracaoRotulo}>Protocolo</span>
                      <span className={styles.configuracaoValor}>LoRa</span>
                    </div>
                  </div>
                </div>
              </div>

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
                    <span>Configuração do rádio</span>
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

              {trocandoDono && estacaoId != null && (
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
                        setTrocandoDono(false)
                      }}
                    >
                      {processando ? 'Trocando...' : 'Trocar'}
                    </button>
                  </div>
                  {erro && <p className={adminStyles.aviso}>{erro}</p>}
                </div>
              )}

              <div className={adminStyles.linhaAcoes}>
                <button type="button" className={adminStyles.botaoAcao} onClick={aoAtualizarRssi} disabled={analisando}>
                  <RefreshCw size={13} className={analisando ? adminStyles.girando : undefined} />
                  {analisando ? 'Solicitando...' : 'Atualizar leitura RSSI'}
                </button>
              </div>
              {avisoAnalise && <p className={adminStyles.aviso}>{avisoAnalise}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default EstacaoAdminCard
