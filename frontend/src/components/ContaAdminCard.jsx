import { useEffect, useRef, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Link2,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Radio,
  Settings2,
  ShieldOff,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import TabelaPermissoesEstacao from './TabelaPermissoesEstacao'
import styles from './ContaAdminCard.module.css'

// Paleta fixa pro avatar — a mesma conta sempre cai na mesma cor (baseado
// no id), só pra distinguir visualmente os cards numa lista longa.
const CORES_AVATAR = ['#4a6fa5', '#7c3aed', '#0891b2', '#16a34a', '#db2777', '#ea580c']

function corDoAvatar(id) {
  return CORES_AVATAR[id % CORES_AVATAR.length]
}

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatarEndereco({ rua, numero, cidade, estado, cep }) {
  const linha1 = [rua, numero].filter(Boolean).join(', ')
  const linha2 = [cidade, estado].filter(Boolean).join('/')
  const partes = [linha1, linha2, cep].filter(Boolean)
  return partes.length ? partes.join(' — ') : '—'
}

function iniciais(nome) {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/)
  return partes
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

// Card de uma conta na tela de Contas do admin: cabeçalho (avatar, nome,
// plano, status, e-mail, contagem de estações) + "Detalhes" expande dados
// completos em caixas, mais um painel com status/estações vinculadas/
// dados da estação/ações rápidas/mais ações, e um rodapé de configuração
// (protocolo + frequência de leitura da estação principal).
function ContaAdminCard({
  conta,
  estacoesDaConta,
  sensoresOrfaos,
  todasEstacoes = [],
  processando,
  erro,
  onAtribuir,
  onVincularEstacaoExistente,
  onSalvarEdicao,
  onSuspenderOuReativar,
  onExcluir,
  onRemoverEstacaoDaLista,
}) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [sensorEscolhido, setSensorEscolhido] = useState('')
  const [mostrarAtribuir, setMostrarAtribuir] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [campos, setCampos] = useState(camposIniciais(conta))
  const menuRef = useRef(null)

  function camposIniciais(c) {
    return {
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      cep: c.cep ?? '',
      rua: c.rua ?? '',
      numero: c.numero ?? '',
      cidade: c.cidade ?? '',
      estado: c.estado ?? '',
    }
  }

  useEffect(() => {
    function aoClicarFora(evento) {
      if (menuRef.current && !menuRef.current.contains(evento.target)) setMenuAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  const nome = [conta.first_name, conta.last_name].filter(Boolean).join(' ') || conta.username
  const estacaoPrincipal = estacoesDaConta[0] ?? null

  // Uma estação pode ter várias contas vinculadas (RN15), então o
  // seletor oferece tanto sensores órfãos (viram uma Estacao nova, já
  // com esta conta) quanto estações que já existem e ainda não incluem
  // esta conta (só adiciona ela à lista, sem mexer em quem já está lá).
  const estacoesParaVincular = todasEstacoes.filter((estacao) => !estacao.usuarios.includes(conta.id))
  const semOpcoes = sensoresOrfaos.length === 0 && estacoesParaVincular.length === 0

  function aoAtribuirEstacao(evento) {
    evento.preventDefault()
    if (!sensorEscolhido) return

    if (sensorEscolhido.startsWith('existente:')) {
      const estacaoId = Number(sensorEscolhido.slice('existente:'.length))
      const estacao = estacoesParaVincular.find((e) => e.id === estacaoId)
      if (estacao) onVincularEstacaoExistente(estacao)
    } else {
      onAtribuir(sensorEscolhido.slice('orfao:'.length))
    }
    setSensorEscolhido('')
  }

  function aoAbrirEdicao() {
    setCampos(camposIniciais(conta))
    setEditando(true)
    setDetalhesAbertos(true)
    setMenuAberto(false)
  }

  async function aoSalvarEdicao(evento) {
    evento.preventDefault()
    const sucesso = await onSalvarEdicao(campos)
    if (sucesso) setEditando(false)
  }

  function aoExcluir() {
    setMenuAberto(false)
    if (
      window.confirm(
        `Excluir a conta de "${nome}"? Essa ação não pode ser desfeita. ${estacoesDaConta.length > 0 ? 'Ela ainda tem estação(ões) vinculada(s), então será bloqueada até você transferir ou remover.' : ''}`,
      )
    ) {
      onExcluir()
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.topo}>
        <div className={styles.identificacao}>
          <div className={styles.avatar} style={{ backgroundColor: corDoAvatar(conta.id) }}>
            {iniciais(nome)}
          </div>
          <div>
            <div className={styles.nomeLinha}>
              <span className={styles.nome}>{nome}</span>
              <span className={styles.planoPill}>{conta.plano_atual ?? 'Sem plano'}</span>
              <span className={`${styles.statusPill} ${conta.is_active ? styles.statusAtiva : styles.statusSuspensa}`}>
                {conta.is_active ? 'Ativa' : 'Suspensa'}
              </span>
            </div>
            <span className={styles.subtexto}>
              <Mail size={12} />
              {conta.email || conta.username}
              <ChevronRight size={12} className={styles.subtextoSeparador} />
              <UserRound size={12} />
              {conta.estacoes_vinculadas} de {conta.plano_max_estacoes ?? '∞'} estação(ões)
            </span>
          </div>
        </div>

        <div className={styles.acoesTopo}>
          <button type="button" className={styles.botaoDetalhes} onClick={() => setDetalhesAbertos((a) => !a)}>
            {detalhesAbertos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {detalhesAbertos ? 'Ocultar detalhes' : 'Ver detalhes'}
          </button>

          <div className={styles.menuWrapper} ref={menuRef}>
            <button
              type="button"
              className={styles.botaoMenu}
              onClick={() => setMenuAberto((a) => !a)}
              aria-label="Mais ações"
              disabled={processando}
            >
              <MoreVertical size={16} />
            </button>
            {menuAberto && (
              <div className={styles.menuDropdown}>
                <button type="button" className={styles.menuItem} onClick={aoAbrirEdicao}>
                  <Pencil size={14} /> Editar dados
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuAberto(false)
                    setMostrarAtribuir((m) => !m)
                  }}
                >
                  <UserPlus size={14} /> Atribuir estação
                </button>
                {estacoesDaConta.length === 1 && (
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      setMenuAberto(false)
                      if (window.confirm(`Remover a estação "${estacaoPrincipal.nome || estacaoPrincipal.identificador}" desta conta?`)) {
                        onRemoverEstacaoDaLista(estacaoPrincipal)
                      }
                    }}
                  >
                    <Radio size={14} /> Remover estação
                  </button>
                )}
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenuAberto(false)
                    onSuspenderOuReativar()
                  }}
                >
                  {conta.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                  {conta.is_active ? 'Suspender conta' : 'Reativar conta'}
                </button>
                <button type="button" className={`${styles.menuItem} ${styles.menuItemPerigo}`} onClick={aoExcluir}>
                  <Trash2 size={14} /> Excluir conta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {detalhesAbertos && (
        <div className={styles.detalhes}>
          {editando ? (
            <form className={styles.formEdicao} onSubmit={aoSalvarEdicao}>
              <div className={styles.gradeEdicao}>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Nome</span>
                  <input
                    className={styles.input}
                    value={campos.first_name}
                    onChange={(e) => setCampos((c) => ({ ...c, first_name: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Sobrenome</span>
                  <input
                    className={styles.input}
                    value={campos.last_name}
                    onChange={(e) => setCampos((c) => ({ ...c, last_name: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>E-mail</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={campos.email}
                    onChange={(e) => setCampos((c) => ({ ...c, email: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Telefone</span>
                  <input
                    className={styles.input}
                    value={campos.telefone}
                    onChange={(e) => setCampos((c) => ({ ...c, telefone: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>CEP</span>
                  <input
                    className={styles.input}
                    placeholder="00000-000"
                    value={campos.cep}
                    onChange={(e) => setCampos((c) => ({ ...c, cep: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Rua</span>
                  <input
                    className={styles.input}
                    value={campos.rua}
                    onChange={(e) => setCampos((c) => ({ ...c, rua: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Número</span>
                  <input
                    className={styles.input}
                    value={campos.numero}
                    onChange={(e) => setCampos((c) => ({ ...c, numero: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Cidade</span>
                  <input
                    className={styles.input}
                    value={campos.cidade}
                    onChange={(e) => setCampos((c) => ({ ...c, cidade: e.target.value }))}
                  />
                </label>
                <label className={styles.campoEdicao}>
                  <span className={styles.infoRotulo}>Estado (UF)</span>
                  <input
                    className={styles.input}
                    placeholder="RJ"
                    maxLength={2}
                    value={campos.estado}
                    onChange={(e) => setCampos((c) => ({ ...c, estado: e.target.value.toUpperCase() }))}
                  />
                </label>
              </div>
              <div className={styles.linhaBotoes}>
                <button type="submit" className={styles.botaoSalvar} disabled={processando}>
                  {processando ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" className={styles.botaoCancelar} onClick={() => setEditando(false)}>
                  <X size={14} /> Cancelar
                </button>
              </div>
              {erro && <p className={styles.aviso}>{erro}</p>}
            </form>
          ) : (
            <>
              <div className={styles.infoGrid}>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <Mail size={12} /> E-mail
                  </span>
                  <span className={styles.infoValor}>{conta.email || '—'}</span>
                </div>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <Phone size={12} /> Telefone
                  </span>
                  <span className={styles.infoValor}>{conta.telefone || '—'}</span>
                </div>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <UserRound size={12} /> Usuário
                  </span>
                  <span className={styles.infoValor}>{conta.username}</span>
                </div>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <MapPin size={12} /> Endereço
                  </span>
                  <span className={styles.infoValor}>{formatarEndereco(conta)}</span>
                </div>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <Calendar size={12} /> Membro desde
                  </span>
                  <span className={styles.infoValor}>{formatarData(conta.date_joined)}</span>
                </div>
                <div className={styles.infoCaixa}>
                  <span className={styles.infoRotulo}>
                    <CreditCard size={12} /> Plano
                  </span>
                  <span className={styles.planoPill}>{conta.plano_atual ?? 'Sem plano'}</span>
                </div>
              </div>

              {estacoesDaConta.length > 0 && (
                <div className={styles.painel}>
                  <span className={styles.painelTitulo}>Permissões por estação</span>
                  <div className={styles.linhaTabelasPermissao}>
                    {estacoesDaConta.map((estacao) => (
                      <TabelaPermissoesEstacao key={estacao.id} estacao={estacao} usuarioId={conta.id} />
                    ))}
                  </div>
                </div>
              )}

              {mostrarAtribuir && (
                <form className={styles.formAtribuir} onSubmit={aoAtribuirEstacao}>
                  <label className={styles.infoRotulo} htmlFor={`sensor-${conta.id}`}>
                    Atribuir estação
                  </label>
                  <div className={styles.linhaAtribuir}>
                    <div className={styles.seletorComIcone}>
                      <Link2 size={14} />
                      <select
                        id={`sensor-${conta.id}`}
                        className={styles.seletor}
                        value={sensorEscolhido}
                        onChange={(evento) => setSensorEscolhido(evento.target.value)}
                        disabled={semOpcoes}
                      >
                        <option value="">{semOpcoes ? 'Nenhuma estação disponível no momento' : 'Selecione um sensor...'}</option>
                        {sensoresOrfaos.length > 0 && (
                          <optgroup label="Sensores novos (sem cadastro)">
                            {sensoresOrfaos.map((orfao) => (
                              <option key={orfao.sensor_id} value={`orfao:${orfao.sensor_id}`}>
                                {orfao.sensor_id}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {estacoesParaVincular.length > 0 && (
                          <optgroup label="Estações já cadastradas">
                            {estacoesParaVincular.map((estacao) => (
                              <option key={estacao.id} value={`existente:${estacao.id}`}>
                                {estacao.nome || estacao.identificador}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    <button type="submit" className={styles.botaoAtribuir} disabled={!sensorEscolhido || processando}>
                      <Link2 size={14} />
                      {processando ? 'Atribuindo...' : 'Atribuir'}
                    </button>
                  </div>
                  {erro && <p className={styles.aviso}>{erro}</p>}
                </form>
              )}

              <div className={styles.blocoRodapeConfig}>
                <span className={styles.painelTitulo}>Configurações da conta</span>
                <div className={styles.rodapeConfig}>
                  <Settings2 size={13} />
                  <span>Protocolo: LoRa</span>
                  <span className={styles.rodapeSeparador}>|</span>
                  <span>
                    Frequência de leitura: {estacaoPrincipal?.intervalo_envio_minutos != null ? `${estacaoPrincipal.intervalo_envio_minutos} min` : '—'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ContaAdminCard
