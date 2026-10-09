import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BatteryMedium,
  Check,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Cpu,
  Droplets,
  Gauge,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SignalHigh,
  Sun,
  Thermometer,
  Trash2,
  UserRound,
  Wind,
  X,
} from 'lucide-react'
import IndicadorTipoEstacao from './IndicadorTipoEstacao'
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

// "agora", "há 1 min", "há 2 min"... mesmo helper de DispositivoLoraCard.jsx.
function formatarTempoRelativo(iso) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos <= 0) return 'agora'
  return `há ${minutos} min`
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
// status, contas vinculadas, localização) + dados atuais da estação
// (temperatura/umidade/vento/pressão — vento fica "—" até existir
// hardware que meça isso de verdade), qualidade do enlace LoRa, status
// do dispositivo e configurações. "Ver detalhes" abre a configuração de
// rádio (RSSI/SNR só de uma análise específica, ID do rádio etc.).
function EstacaoAdminCard({
  dispositivo,
  contas = [],
  processando,
  erro,
  analisando,
  erroAnalise,
  onGerenciarUsuarios,
  onRemover,
  onSalvarEdicao,
  onAtualizarDadosOnline,
  onAnalisar,
  onExcluirLeiturasOrfas,
}) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [gerenciandoUsuarios, setGerenciandoUsuarios] = useState(false)
  const [usuariosSelecionados, setUsuariosSelecionados] = useState([])
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function aoClicarFora(evento) {
      if (menuRef.current && !menuRef.current.contains(evento.target)) setMenuAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  // Mesmo comportamento de DispositivoLoraCard.jsx: ao pedir a análise, os
  // detalhes abrem sozinhos — sem isso, a resposta chegaria escondida atrás
  // do "Ver detalhes" fechado.
  useEffect(() => {
    if (analisando) setDetalhesAbertos(true)
  }, [analisando])

  const {
    sensor_id: sensorId,
    data_hora: dataHora,
    estacaoId,
    usuariosInfo = [],
    nome,
    localizacao,
    intervaloEnvioMinutos,
    limiteOfflineMinutos,
    ativa,
    tipo,
    temperatura,
    umidade,
    pressao,
    deltaTemperatura,
    deltaUmidade,
    deltaPressao,
    ultimaAnaliseRssi,
    ultimaConfiguracao,
  } = dispositivo
  // Ao contrário de DispositivoLoraCard.jsx (hardware que reporta a cada
  // 1-10 min, por isso usa um limiar fixo curto), aqui o intervalo real
  // varia por estação — uma estação "online" (Open-Meteo) só tem dado
  // novo por hora, então teria que usar o `limite_offline_minutos` da
  // própria Estacao (o mesmo campo que o backend usa pra `esta_offline`),
  // nunca um limiar fixo de poucos minutos.
  const limiteOfflineMs = (limiteOfflineMinutos ?? 30) * 60 * 1000
  const online = Boolean(dataHora) && Date.now() - new Date(dataHora).getTime() < limiteOfflineMs
  const uidRemoto = ultimaConfiguracao?.dados_adicionais?.uid_remoto
  // Estação online (ver Estacao.tipo em api_rest/models.py) grava vento
  // aninhado em dados_adicionais.vento (ver api_rest/open_meteo.py) — é a
  // única fonte real de vento hoje, por isso é esse o formato seguido.
  const velocidadeVento = dispositivo.dados_adicionais?.vento?.velocidade
  const direcaoVento = dispositivo.dados_adicionais?.vento?.direcao
  const chuva = dispositivo.dados_adicionais?.chuva
  const radiacao = dispositivo.dados_adicionais?.radiacao

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

  return (
    <div className={styles.card}>
      <div className={styles.topo}>
        <div className={styles.identificacao}>
          <div className={styles.iconeChip}>
            <Cpu size={20} />
          </div>
          <div>
            <div className={styles.nomeLinha}>
              <IndicadorTipoEstacao tipo={tipo} />
              <span className={styles.nome}>{nome || sensorId}</span>
              <span className={`${styles.statusPill} ${online ? styles.statusOnline : styles.statusOffline}`}>
                {online ? 'Online' : 'Offline'}
              </span>
              {ativa === false && <span className={adminStyles.semDonoPill}>Inativa</span>}
              {usuariosInfo.length === 0 ? (
                <span className={adminStyles.semDonoPill}>Sem usuários vinculados</span>
              ) : (
                <>
                  <span className={adminStyles.donoPill}>
                    <UserRound size={11} />
                    {usuariosInfo[0].nome}
                  </span>
                  {usuariosInfo.length > 1 && <span className={adminStyles.planoPill}>+{usuariosInfo.length - 1}</span>}
                </>
              )}
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
                {estacaoId != null ? (
                  <>
                    <button type="button" className={adminStyles.menuItem} onClick={abrirEdicao}>
                      <Pencil size={14} /> Configurações
                    </button>
                    <button
                      type="button"
                      className={adminStyles.menuItem}
                      onClick={() => {
                        setMenuAberto(false)
                        setUsuariosSelecionados(usuariosInfo.map((usuario) => usuario.id))
                        setBuscaUsuario('')
                        setGerenciandoUsuarios(true)
                        setDetalhesAbertos(true)
                      }}
                    >
                      <UserRound size={14} /> Gerenciar usuários
                    </button>
                    {tipo === 'online' && (
                      <button
                        type="button"
                        className={adminStyles.menuItem}
                        disabled={processando}
                        onClick={() => {
                          setMenuAberto(false)
                          onAtualizarDadosOnline()
                        }}
                      >
                        <RefreshCw size={14} /> Atualizar agora
                      </button>
                    )}
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
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${adminStyles.menuItem} ${adminStyles.menuItemPerigo}`}
                    onClick={() => {
                      setMenuAberto(false)
                      if (
                        window.confirm(
                          `Apagar todas as leituras de "${sensorId}"? Sem estação cadastrada, elas não servem pra nada — essa ação não pode ser desfeita.`,
                        )
                      ) {
                        onExcluirLeiturasOrfas()
                      }
                    }}
                  >
                    <Trash2 size={14} /> Excluir leituras
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {estacaoId == null && erro && <p className={adminStyles.aviso}>{erro}</p>}

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
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <CloudRain size={14} className={adminStyles.iconeChuva} />
              <span>Chuva</span>
            </div>
            <span className={adminStyles.tileValor}>{chuva != null ? `${chuva} mm` : '—'}</span>
          </div>
          <div className={adminStyles.tile}>
            <div className={adminStyles.tileCabecalho}>
              <Sun size={14} className={adminStyles.iconeRadiacao} />
              <span>Radiação solar</span>
            </div>
            <span className={adminStyles.tileValor}>{radiacao != null ? `${radiacao} W/m²` : '—'}</span>
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
                    <option value={60}>1 hora</option>
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

              {gerenciandoUsuarios && estacaoId != null && (
                <div className={adminStyles.gerenciar}>
                  <div className={styles.secaoTitulo}>
                    <UserRound size={14} />
                    <span>Usuários vinculados ({usuariosSelecionados.length})</span>
                  </div>

                  <div className={adminStyles.chipsUsuarios}>
                    {usuariosSelecionados.length === 0 ? (
                      <p className={adminStyles.avisoDiscreto}>Nenhum usuário vinculado ainda.</p>
                    ) : (
                      usuariosSelecionados.map((id) => {
                        const conta = contas.find((c) => c.id === id)
                        return (
                          <span key={id} className={adminStyles.chipUsuario}>
                            <UserRound size={12} />
                            {conta ? conta.first_name || conta.username : `conta #${id}`}
                            <button
                              type="button"
                              className={adminStyles.chipRemover}
                              disabled={processando}
                              aria-label="Remover"
                              onClick={() => setUsuariosSelecionados((atual) => atual.filter((existente) => existente !== id))}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        )
                      })
                    )}
                  </div>

                  <div className={adminStyles.campoBuscaUsuario}>
                    <Search size={13} />
                    <input
                      placeholder="Buscar conta pra adicionar..."
                      value={buscaUsuario}
                      onChange={(e) => setBuscaUsuario(e.target.value)}
                    />
                  </div>
                  <div className={adminStyles.listaAdicionarUsuarios}>
                    {(() => {
                      const buscaNormalizada = buscaUsuario.trim().toLowerCase()
                      const disponiveis = contas.filter((conta) => {
                        if (usuariosSelecionados.includes(conta.id)) return false
                        if (!buscaNormalizada) return true
                        const nome = (conta.first_name || conta.username).toLowerCase()
                        return nome.includes(buscaNormalizada) || conta.username.toLowerCase().includes(buscaNormalizada)
                      })
                      if (disponiveis.length === 0) {
                        return (
                          <p className={adminStyles.avisoDiscreto}>
                            {buscaNormalizada ? 'Nenhuma conta encontrada.' : 'Todas as contas já estão vinculadas.'}
                          </p>
                        )
                      }
                      return disponiveis.map((conta) => (
                        <button
                          key={conta.id}
                          type="button"
                          className={adminStyles.itemAdicionarUsuario}
                          disabled={processando}
                          onClick={() => {
                            setUsuariosSelecionados((atual) => [...atual, conta.id])
                            setBuscaUsuario('')
                          }}
                        >
                          <Plus size={13} />
                          {conta.first_name || conta.username}
                          <span className={adminStyles.itemAdicionarPlano}>{conta.plano_atual ?? 'sem plano'}</span>
                        </button>
                      ))
                    })()}
                  </div>

                  <div className={adminStyles.linhaTrocarDono}>
                    <button
                      type="button"
                      className={adminStyles.botaoTrocar}
                      disabled={processando}
                      onClick={async () => {
                        const sucesso = await onGerenciarUsuarios(usuariosSelecionados)
                        if (sucesso) setGerenciandoUsuarios(false)
                      }}
                    >
                      {processando ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button type="button" className={styles.botaoDetalhes} onClick={() => setGerenciandoUsuarios(false)}>
                      <X size={14} /> Cancelar
                    </button>
                  </div>
                  {erro && <p className={adminStyles.aviso}>{erro}</p>}
                </div>
              )}

              <div className={adminStyles.linhaAcoes}>
                <button type="button" className={adminStyles.botaoAcao} onClick={onAnalisar} disabled={analisando}>
                  <RefreshCw size={13} className={analisando ? adminStyles.girando : undefined} />
                  {analisando ? 'Aguardando resposta…' : 'Atualizar leitura RSSI'}
                </button>
                <span className={styles.dicaEspera}>
                  {ultimaAnaliseRssi
                    ? `Última leitura de RSSI: ${formatarTempoRelativo(ultimaAnaliseRssi.data_hora)}`
                    : 'Nenhuma leitura de RSSI ainda'}
                </span>
              </div>
              {erroAnalise && <p className={adminStyles.aviso}>{erroAnalise}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default EstacaoAdminCard
