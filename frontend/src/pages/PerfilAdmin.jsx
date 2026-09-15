import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  KeyRound,
  IdCard,
  Camera,
  ShieldCheck,
  ShieldQuestion,
  Lock,
  Smartphone,
  Users,
  TrendingUp,
  Check,
  Radio,
  MapPin,
  Check as CheckSalvo,
} from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import imagemApoioPerfil from '../assets/apoio-perfil.jpeg'
import { buscarMeuPerfil, atualizarMeuPerfil, trocarMinhaSenha } from '../services/perfilService'
import { buscarContas, buscarContasAdministradoras } from '../services/contasAdminService'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import styles from './Perfil.module.css'

function iniciaisDoNome(nomeCompleto, username) {
  const base = nomeCompleto?.trim() || username || ''
  const palavras = base.split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return '—'
  return palavras
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function formatarData(dataISO) {
  if (!dataISO) return '—'
  return new Date(dataISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Junta rua/número, cidade/UF e CEP num texto só, omitindo as partes que
// a pessoa ainda não preencheu — em vez de mostrar "—" pra cada campo
// separado (endereço é sempre opcional).
function formatarEndereco({ rua, numero, cidade, estado, cep }) {
  const linha1 = [rua, numero].filter(Boolean).join(', ')
  const linha2 = [cidade, estado].filter(Boolean).join('/')
  const partes = [linha1, linha2, cep].filter(Boolean)
  return partes.length ? partes.join(' — ') : '—'
}

// Itens de segurança/privacidade sem recurso real por trás ainda (2FA,
// sessões, histórico de acesso, preferências de privacidade granulares) —
// mostrados como "Em breve" em vez de fingir um estado que não existe.
function LinhaEmBreve({ icone: Icone, rotulo }) {
  return (
    <li className={styles.linhaLista}>
      <span className={styles.rotuloLinha}>
        <Icone size={15} />
        {rotulo}
      </span>
      <span className={styles.valorEmBreve}>Em breve</span>
    </li>
  )
}

// Perfil do Gestor — mesmo layout/design de Perfil.jsx (Usuário), com o
// bloco de "Resumo da conta" trocado: não existe plano/estação vinculada
// pra um Gestor, então essa seção mostra números reais do painel que ele
// administra (contas, estações, sensores sem dono) em vez disso.
function PerfilAdmin() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState(null)
  const [resumoPainel, setResumoPainel] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [administradores, setAdministradores] = useState([])
  const [adminExpandidoId, setAdminExpandidoId] = useState(null)

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [cidade, setCidade] = useState('')
  const [estadoUf, setEstadoUf] = useState('')
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [dadosSalvos, setDadosSalvos] = useState(false)
  const [erroDados, setErroDados] = useState('')

  const [trocandoSenhaAberto, setTrocandoSenhaAberto] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [senhaTrocada, setSenhaTrocada] = useState(false)
  const [erroSenha, setErroSenha] = useState('')

  useEffect(() => {
    Promise.all([buscarMeuPerfil(), buscarContas(), buscarEstacoes(), buscarSensoresOrfaos(), buscarContasAdministradoras()])
      .then(([dadosPerfil, contas, estacoes, orfaos, admins]) => {
        setPerfil(dadosPerfil)
        setAdministradores(admins)
        setNome(dadosPerfil.first_name)
        setSobrenome(dadosPerfil.last_name)
        setEmail(dadosPerfil.email)
        setTelefone(dadosPerfil.telefone ?? '')
        setCep(dadosPerfil.cep ?? '')
        setRua(dadosPerfil.rua ?? '')
        setNumero(dadosPerfil.numero ?? '')
        setCidade(dadosPerfil.cidade ?? '')
        setEstadoUf(dadosPerfil.estado ?? '')
        setResumoPainel({ contas: contas.length, estacoes: estacoes.length, orfaos: orfaos.length })
      })
      .finally(() => setCarregando(false))
  }, [])

  async function aoSalvarDados(evento) {
    evento.preventDefault()
    setErroDados('')
    setSalvandoDados(true)
    try {
      const atualizado = await atualizarMeuPerfil(perfil.id, {
        first_name: nome,
        last_name: sobrenome,
        email,
        telefone,
        cep,
        rua,
        numero,
        cidade,
        estado: estadoUf,
      })
      setPerfil(atualizado)
      setDadosSalvos(true)
      setEditando(false)
      setTimeout(() => setDadosSalvos(false), 2500)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      setErroDados(dados?.email?.[0] || 'Não foi possível salvar. Confira os dados.')
    } finally {
      setSalvandoDados(false)
    }
  }

  async function aoTrocarSenha(evento) {
    evento.preventDefault()
    setErroSenha('')
    setTrocandoSenha(true)
    try {
      await trocarMinhaSenha(perfil.id, senhaAtual, novaSenha)
      setSenhaAtual('')
      setNovaSenha('')
      setSenhaTrocada(true)
      setTrocandoSenhaAberto(false)
      setTimeout(() => setSenhaTrocada(false), 2500)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      setErroSenha(dados?.senha_atual?.[0] || dados?.password?.[0] || 'Não foi possível trocar a senha.')
    } finally {
      setTrocandoSenha(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando perfil..." />
      </div>
    )
  }

  const nomeCompletoAtual = [perfil.first_name, perfil.last_name].filter(Boolean).join(' ') || perfil.username
  const iniciais = iniciaisDoNome(nomeCompletoAtual, perfil.username)

  return (
    <div className={styles.pagina}>
      <div className={styles.grade}>
        {/* Informações pessoais */}
        <section className={styles.cartao}>
          <div className={styles.cabecalhoCartao}>
            <h2 className={styles.tituloCartao}>
              <User size={17} />
              Informações pessoais
            </h2>
            <button type="button" className={styles.botaoContorno} onClick={() => setEditando((atual) => !atual)}>
              {editando ? 'Cancelar' : 'Editar informações'}
            </button>
          </div>

          <div className={styles.blocoIdentidade}>
            <div className={styles.avatarGrande}>
              {iniciais}
              <span className={styles.botaoCamera} title="Foto de perfil (em breve)">
                <Camera size={13} />
              </span>
            </div>
            <div>
              <span className={styles.nomeGrande}>{nomeCompletoAtual}</span>
              <span className={styles.desdeQuando}>Administrador desde {formatarData(perfil.date_joined)}</span>
              {perfil.email_verificado && (
                <span className={styles.seloVerificado}>
                  <ShieldCheck size={12} />
                  Conta verificada
                </span>
              )}
            </div>
          </div>

          {editando ? (
            <form className={styles.formEdicao} onSubmit={aoSalvarDados}>
              <div className={styles.linha2Colunas}>
                <div>
                  <label className={styles.rotuloCampo}>Nome</label>
                  <input className={styles.campo} value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <label className={styles.rotuloCampo}>Sobrenome</label>
                  <input className={styles.campo} value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
                </div>
              </div>
              <label className={styles.rotuloCampo}>E-mail</label>
              <input className={styles.campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className={styles.rotuloCampo}>Telefone</label>
              <input className={styles.campo} value={telefone} onChange={(e) => setTelefone(e.target.value)} />

              <div className={styles.linha2Colunas}>
                <div>
                  <label className={styles.rotuloCampo}>CEP</label>
                  <input className={styles.campo} placeholder="00000-000" value={cep} onChange={(e) => setCep(e.target.value)} />
                </div>
                <div>
                  <label className={styles.rotuloCampo}>Cidade</label>
                  <input className={styles.campo} value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
              </div>
              <div className={styles.linha2Colunas}>
                <div>
                  <label className={styles.rotuloCampo}>Rua</label>
                  <input className={styles.campo} value={rua} onChange={(e) => setRua(e.target.value)} />
                </div>
                <div>
                  <label className={styles.rotuloCampo}>Número</label>
                  <input className={styles.campo} value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
              </div>
              <label className={styles.rotuloCampo}>Estado (UF)</label>
              <input
                className={styles.campo}
                placeholder="RJ"
                maxLength={2}
                value={estadoUf}
                onChange={(e) => setEstadoUf(e.target.value.toUpperCase())}
              />

              {erroDados && <p className={styles.erro}>{erroDados}</p>}

              <button type="submit" className={styles.botaoPrimario} disabled={salvandoDados}>
                {salvandoDados ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>
          ) : (
            <ul className={styles.listaDados}>
              <li>
                <User size={15} />
                <span>
                  <span className={styles.rotuloDado}>Nome completo</span>
                  <span className={styles.valorDado}>{nomeCompletoAtual}</span>
                </span>
              </li>
              <li>
                <Mail size={15} />
                <span>
                  <span className={styles.rotuloDado}>E-mail</span>
                  <span className={styles.valorDado}>{perfil.email || '—'}</span>
                </span>
              </li>
              <li>
                <Phone size={15} />
                <span>
                  <span className={styles.rotuloDado}>Telefone</span>
                  <span className={styles.valorDado}>{perfil.telefone || '—'}</span>
                </span>
              </li>
              <li>
                <MapPin size={15} />
                <span>
                  <span className={styles.rotuloDado}>Endereço</span>
                  <span className={styles.valorDado}>{formatarEndereco(perfil)}</span>
                </span>
              </li>
              <li>
                <KeyRound size={15} />
                <span>
                  <span className={styles.rotuloDado}>Login de acesso</span>
                  <span className={styles.valorDado}>{perfil.username}</span>
                </span>
              </li>
              <li>
                <IdCard size={15} />
                <span>
                  <span className={styles.rotuloDado}>CPF</span>
                  <span className={styles.valorDado}>{perfil.cpf || '—'}</span>
                </span>
              </li>
            </ul>
          )}

          {dadosSalvos && (
            <p className={styles.avisoSalvo}>
              <CheckSalvo size={14} />
              Dados salvos com sucesso.
            </p>
          )}

          <div className={styles.avisoProtecao}>
            <ShieldCheck size={16} />
            <div>
              <strong>Suas informações são protegidas</strong>
              <p>Sua senha é armazenada com hash — nunca guardamos ou exibimos ela em texto puro.</p>
            </div>
          </div>
        </section>

        {/* Segurança + privacidade */}
        <div className={styles.colunaLateral}>
          <section className={styles.cartao}>
            <div className={styles.cabecalhoCartao}>
              <h2 className={styles.tituloCartao}>
                <Lock size={17} />
                Segurança da conta
              </h2>
            </div>
            <ul className={styles.listaLinhas}>
              <li className={styles.linhaLista}>
                <span className={styles.rotuloLinha}>
                  <KeyRound size={15} />
                  Senha
                </span>
                <button
                  type="button"
                  className={styles.linkAcao}
                  onClick={() => setTrocandoSenhaAberto((atual) => !atual)}
                >
                  {trocandoSenhaAberto ? 'Cancelar' : 'Alterar'}
                </button>
              </li>

              {trocandoSenhaAberto && (
                <form className={styles.formSenha} onSubmit={aoTrocarSenha}>
                  <label className={styles.rotuloCampo}>Senha atual</label>
                  <input
                    className={styles.campo}
                    type="password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    required
                  />
                  <label className={styles.rotuloCampo}>Nova senha</label>
                  <input
                    className={styles.campo}
                    type="password"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    minLength={8}
                    required
                  />
                  {erroSenha && <p className={styles.erro}>{erroSenha}</p>}
                  <button type="submit" className={styles.botaoPrimario} disabled={trocandoSenha}>
                    {trocandoSenha ? 'Alterando...' : 'Confirmar nova senha'}
                  </button>
                </form>
              )}

              <LinhaEmBreve icone={Smartphone} rotulo="Verificação em duas etapas" />
              <LinhaEmBreve icone={ShieldQuestion} rotulo="Privacidade de dados" />
            </ul>
            {senhaTrocada && (
              <p className={styles.avisoSalvo}>
                <CheckSalvo size={14} />
                Senha alterada com sucesso.
              </p>
            )}
          </section>

          <section className={styles.cartao}>
            <div className={styles.cabecalhoCartao}>
              <h2 className={styles.tituloCartao}>
                <ShieldQuestion size={17} />
                Preferências de privacidade
              </h2>
            </div>
            <ul className={styles.listaLinhas}>
              <LinhaEmBreve icone={Users} rotulo="Compartilhamento de dados" />
            </ul>
          </section>

          <section className={styles.cartao}>
            <div className={styles.cabecalhoCartao}>
              <h2 className={styles.tituloCartao}>
                <Users size={17} />
                Contas administradoras
              </h2>
            </div>
            {administradores.length === 0 ? (
              <p className={styles.valorEmBreve}>Nenhuma outra conta administradora cadastrada.</p>
            ) : (
              <ul className={styles.listaLinhas}>
                {administradores.map((admin) => {
                  const nomeAdmin = [admin.first_name, admin.last_name].filter(Boolean).join(' ') || admin.username
                  const expandido = adminExpandidoId === admin.id
                  return (
                    <Fragment key={admin.id}>
                      <li className={styles.linhaLista}>
                        <span className={styles.rotuloLinha}>
                          <User size={15} />
                          {nomeAdmin}
                        </span>
                        <button
                          type="button"
                          className={styles.linkAcao}
                          onClick={() => setAdminExpandidoId(expandido ? null : admin.id)}
                        >
                          {expandido ? 'Fechar' : 'Ver dados'}
                        </button>
                      </li>
                      {expandido && (
                        <li>
                          <ul className={styles.listaDados}>
                            <li>
                              <Mail size={15} />
                              <span>
                                <span className={styles.rotuloDado}>E-mail</span>
                                <span className={styles.valorDado}>{admin.email || '—'}</span>
                              </span>
                            </li>
                            <li>
                              <Phone size={15} />
                              <span>
                                <span className={styles.rotuloDado}>Telefone</span>
                                <span className={styles.valorDado}>{admin.telefone || '—'}</span>
                              </span>
                            </li>
                            <li>
                              <MapPin size={15} />
                              <span>
                                <span className={styles.rotuloDado}>Endereço</span>
                                <span className={styles.valorDado}>{formatarEndereco(admin)}</span>
                              </span>
                            </li>
                            <li>
                              <KeyRound size={15} />
                              <span>
                                <span className={styles.rotuloDado}>Login de acesso</span>
                                <span className={styles.valorDado}>{admin.username}</span>
                              </span>
                            </li>
                          </ul>
                        </li>
                      )}
                    </Fragment>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Resumo do painel — versão admin do "Resumo da conta": não tem
            plano nem estação vinculada, então mostra números reais do que
            esse Gestor administra. */}
        <section className={`${styles.cartao} ${styles.cartaoResumo}`}>
          <h2 className={styles.tituloCartao}>
            <TrendingUp size={17} />
            Resumo do painel
          </h2>

          <div className={styles.corpoResumo}>
            <div className={styles.colunaResumoInfo}>
              <div className={styles.gradeResumo}>
                <div>
                  <span className={styles.rotuloResumo}>Papel</span>
                  <span className={styles.valorResumo}>
                    Administrador
                    <span className={styles.seloResumo}>
                      <ShieldCheck size={11} />
                      Acesso total
                    </span>
                  </span>
                </div>
                <div>
                  <span className={styles.rotuloResumo}>Contas gerenciadas</span>
                  <span className={styles.valorResumo}>{resumoPainel.contas}</span>
                </div>
                <div>
                  <span className={styles.rotuloResumo}>Estações cadastradas</span>
                  <span className={styles.valorResumo}>
                    {resumoPainel.estacoes}
                    {resumoPainel.orfaos > 0 && (
                      <span className={styles.seloResumo}>
                        <Radio size={11} />
                        {resumoPainel.orfaos} sem dono
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className={styles.blocoUpgrade}>
                <div>
                  <strong>Visão geral do painel</strong>
                  <p>Acompanhe estações, contas e alertas num só lugar.</p>
                </div>
                <button type="button" className={styles.botaoContorno} onClick={() => navigate('/app/adm/dashboard')}>
                  Ir para o Dashboard
                </button>
              </div>
            </div>

            <div className={styles.colunaResumoRecursos}>
              <span className={styles.tituloRecursos}>O que uma conta Administrador pode fazer</span>
              <ul className={styles.listaRecursos}>
                <li>
                  <Check size={14} />
                  Acesso irrestrito a todas as contas e estações
                </li>
                <li>
                  <Check size={14} />
                  Cadastrar, vincular e remover estações de qualquer conta
                </li>
                <li>
                  <Check size={14} />
                  Suspender, reativar ou excluir contas
                </li>
                <li>
                  <Check size={14} />
                  Executar limpeza de dados operacionais
                </li>
              </ul>
            </div>

            <img src={imagemApoioPerfil} alt="" className={styles.ilustracao} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default PerfilAdmin
