import { useEffect, useState } from 'react'
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
  Monitor,
  History,
  Users,
  Globe,
  Bell,
  TrendingUp,
  Check,
  Radio,
  Check as CheckSalvo,
} from 'lucide-react'
import CabecalhoStandard from '../components/CabecalhoStandard'
import StatusMessage from '../components/StatusMessage'
import imagemApoioPerfil from '../assets/apoio-perfil.jpeg'
import { buscarMeuPerfil, atualizarMeuPerfil, trocarMinhaSenha } from '../services/perfilService'
import { buscarPlanos } from '../services/planosService'
import { obterEstacaoVinculada } from '../services/estacaoService'
import { obterClaimsDoToken } from '../services/authService'
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

// Tela de Perfil, reformulada: dados pessoais + segurança + privacidade +
// resumo da conta/plano, com a ilustração de apoio fornecida pra usuária.
function Perfil() {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState(null)
  const [plano, setPlano] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const estacao = obterEstacaoVinculada()
  const nomePlanoAtual = obterClaimsDoToken()?.plano

  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
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
    Promise.all([buscarMeuPerfil(), buscarPlanos()])
      .then(([dadosPerfil, planos]) => {
        setPerfil(dadosPerfil)
        setNome(dadosPerfil.first_name)
        setSobrenome(dadosPerfil.last_name)
        setEmail(dadosPerfil.email)
        setTelefone(dadosPerfil.telefone ?? '')
        setPlano(planos.find((p) => p.nome === nomePlanoAtual) ?? null)
      })
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const cabecalho = (
    <CabecalhoStandard
      identificadorEstacao={estacao?.identificador ?? '—'}
      subtitulo="Gerencie suas informações pessoais, segurança da conta e preferências de privacidade."
      mostrarExportar={false}
      mostrarChips={false}
    />
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando perfil..." />
      </div>
    )
  }

  const nomeCompletoAtual = [perfil.first_name, perfil.last_name].filter(Boolean).join(' ') || perfil.username
  const iniciais = iniciaisDoNome(nomeCompletoAtual, perfil.username)
  const estacoesUsadas = estacao ? 1 : 0

  return (
    <div className={styles.pagina}>
      {cabecalho}

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
              <span className={styles.desdeQuando}>Usuária desde {formatarData(perfil.date_joined)}</span>
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
              <LinhaEmBreve icone={Monitor} rotulo="Sessões ativas" />
              <LinhaEmBreve icone={History} rotulo="Histórico de acessos" />
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
              <LinhaEmBreve icone={ShieldQuestion} rotulo="Privacidade de dados" />
              <LinhaEmBreve icone={Users} rotulo="Compartilhamento de dados" />
              <LinhaEmBreve icone={Globe} rotulo="Cookies e rastreamento" />
              <LinhaEmBreve icone={Bell} rotulo="Comunicações" />
            </ul>
          </section>
        </div>

        {/* Resumo da conta */}
        <section className={`${styles.cartao} ${styles.cartaoResumo}`}>
          <h2 className={styles.tituloCartao}>
            <TrendingUp size={17} />
            Resumo da conta
          </h2>

          <div className={styles.corpoResumo}>
            <div className={styles.colunaResumoInfo}>
              <div className={styles.gradeResumo}>
                <div>
                  <span className={styles.rotuloResumo}>Plano atual</span>
                  <span className={styles.valorResumo}>
                    {plano?.nome ?? nomePlanoAtual ?? '—'}
                    <span className={styles.seloResumo}>{Number(plano?.preco_mensal) === 0 ? 'Gratuito' : 'Pago'}</span>
                  </span>
                </div>
                <div>
                  <span className={styles.rotuloResumo}>Estação vinculada</span>
                  <span className={styles.valorResumo}>
                    {estacao?.identificador ?? 'Nenhuma'}
                    {estacao && (
                      <span className={styles.seloResumo}>
                        <Radio size={11} />
                        Ativa
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className={styles.rotuloResumo}>Limite de estações</span>
                  <span className={styles.valorResumo}>
                    {estacoesUsadas} de {plano?.max_estacoes ?? '—'} utilizada{plano?.max_estacoes === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <div className={styles.blocoUpgrade}>
                <div>
                  <strong>Próximo upgrade</strong>
                  <p>Aproveite mais recursos fazendo upgrade do plano.</p>
                </div>
                <button type="button" className={styles.botaoContorno} onClick={() => navigate('/app/plano')}>
                  Ver planos
                </button>
              </div>
            </div>

            <div className={styles.colunaResumoRecursos}>
              <span className={styles.tituloRecursos}>O que está incluído no plano {plano?.nome ?? nomePlanoAtual}</span>
              <ul className={styles.listaRecursos}>
                <li>
                  <Check size={14} />
                  Dados em tempo real
                </li>
                <li>
                  <Check size={14} />
                  Histórico de {plano?.dias_historico ?? '—'} dias
                </li>
                <li>
                  <Check size={14} />
                  Até {plano?.max_estacoes ?? '—'} estação(ões) vinculada(s)
                </li>
                {plano?.funcionalidades_detalhe?.map((funcionalidade) => (
                  <li key={funcionalidade.id}>
                    <Check size={14} />
                    {funcionalidade.nome}
                  </li>
                ))}
              </ul>
            </div>

            <img src={imagemApoioPerfil} alt="" className={styles.ilustracao} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default Perfil
