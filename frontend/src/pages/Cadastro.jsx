import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, IdCard, KeyRound, Lock, Mail, MailCheck, User } from 'lucide-react'
import fundoAutenticacao from '../assets/fundo-autenticacao.png'
import { cadastrar, reenviarConfirmacaoPublico } from '../services/authService'
import { buscarPlanos } from '../services/planosService'
import styles from './Cadastro.module.css'

// Tela de cadastro público. Dois jeitos de criar conta, alternados pelo
// cartão "Tenho um token de credenciamento" abaixo do botão principal:
// - escolhendo um plano (Standard/Pro/Plus) -> vira Usuário comum;
// - digitando o token da organização -> vira Gestor (acesso total),
//   sem precisar escolher plano nenhum.
function Cadastro() {
  const [cadastroConcluido, setCadastroConcluido] = useState(false)
  const [emailCadastrado, setEmailCadastrado] = useState('')
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  const [planos, setPlanos] = useState([])
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(null)
  const [modoCredenciada, setModoCredenciada] = useState(false)
  const [tokenCredenciamento, setTokenCredenciamento] = useState('')

  const [email, setEmail] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false)

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    buscarPlanos()
      .then((dados) => {
        const ativos = dados.filter((plano) => plano.ativo).sort((a, b) => a.ordem - b.ordem)
        setPlanos(ativos)
        // Plano "do meio" pré-selecionado, igual à referência (o Pro
        // aparece marcado como "mais escolhido" por padrão).
        setPlanoSelecionadoId(ativos[Math.min(1, ativos.length - 1)]?.id ?? null)
      })
      .catch(() => setPlanos([]))
  }, [])

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }
    if (!modoCredenciada && !planoSelecionadoId) {
      setErro('Escolha um plano para continuar.')
      return
    }

    setCarregando(true)
    try {
      await cadastrar({
        email,
        nomeCompleto,
        cpf,
        password: senha,
        confirmarSenha,
        planoId: modoCredenciada ? null : planoSelecionadoId,
        tokenCredenciamento: modoCredenciada ? tokenCredenciamento : null,
      })
      // Não loga automaticamente: o cadastro só se completa de verdade
      // com o e-mail confirmado (RN) — mostra a tela pedindo isso em vez
      // de já cair no dashboard.
      setEmailCadastrado(email)
      setCadastroConcluido(true)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const primeiraMensagem = dados && Object.values(dados).flat()[0]
      setErro(primeiraMensagem || 'Não foi possível criar a conta. Confira os dados e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  async function aoReenviar() {
    setReenviando(true)
    try {
      await reenviarConfirmacaoPublico(emailCadastrado)
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  // Tela pública sempre clara — não segue o dia/noite do dashboard interno.
  if (cadastroConcluido) {
    return (
      <div className={styles.fundo} data-theme="dia">
        <div className={styles.pagina}>
          <aside
            className={styles.painelMarketing}
            style={{ backgroundImage: `url(${fundoAutenticacao})` }}
            aria-hidden="true"
          />
          <main className={styles.painelFormulario}>
            <div className={styles.cartao}>
              <span className={styles.iconeCabecalho} style={{ alignSelf: 'center' }}>
                <MailCheck size={22} />
              </span>
              <h2 className={styles.tituloForm} style={{ textAlign: 'center' }}>Confira seu e-mail</h2>
              <p className={styles.subtituloForm} style={{ textAlign: 'center' }}>
                Mandamos um link de confirmação para <strong>{emailCadastrado}</strong>. Clique nele
                para completar o cadastro e poder entrar.
              </p>

              {reenviado ? (
                <p className={styles.subtituloForm} style={{ textAlign: 'center' }}>
                  Reenviado! Se não chegar em alguns minutos, confira o spam.
                </p>
              ) : (
                <button type="button" className={styles.opcaoCredenciada} onClick={aoReenviar} disabled={reenviando}>
                  <MailCheck size={18} />
                  <span className={styles.opcaoCredenciadaTexto}>
                    <strong>{reenviando ? 'Reenviando...' : 'Não recebi o e-mail'}</strong>
                    <small>Clique para receber o link de novo</small>
                  </span>
                </button>
              )}

              <p className={styles.linkLogin}>
                Já confirmou? <Link to="/login">Fazer login</Link>
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.fundo} data-theme="dia">
      <div className={styles.pagina}>
        {/* A própria imagem já traz logo, texto de chamada, cards e
            ícones prontos — por isso o painel não tem mais nenhum
            conteúdo próprio, só a imagem de fundo. */}
        <aside
          className={styles.painelMarketing}
          style={{ backgroundImage: `url(${fundoAutenticacao})` }}
          aria-hidden="true"
        />

        <main className={styles.painelFormulario}>
          <form className={styles.cartao} onSubmit={aoEnviar}>
            <div className={styles.cabecalhoForm}>
              <span className={styles.iconeCabecalho}>
                <User size={20} />
              </span>
              <div>
                <h2 className={styles.tituloForm}>Criar conta</h2>
                <p className={styles.subtituloForm}>Preencha seus dados para começar</p>
              </div>
            </div>

            <label className={styles.campo}>
              <span className={styles.rotulo}>E-mail</span>
              <span className={styles.inputComIcone}>
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <div className={styles.linha2Colunas}>
              <label className={styles.campo}>
                <span className={styles.rotulo}>Nome completo</span>
                <span className={styles.inputComIcone}>
                  <User size={16} />
                  <input
                    type="text"
                    value={nomeCompleto}
                    onChange={(evento) => setNomeCompleto(evento.target.value)}
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    required
                  />
                </span>
              </label>

              <label className={styles.campo}>
                <span className={styles.rotulo}>CPF</span>
                <span className={styles.inputComIcone}>
                  <IdCard size={16} />
                  <input
                    type="text"
                    value={cpf}
                    onChange={(evento) => setCpf(evento.target.value)}
                    placeholder="000.000.000-00"
                    required
                  />
                </span>
              </label>
            </div>

            <div className={styles.linha2Colunas}>
              <label className={styles.campo}>
                <span className={styles.rotulo}>Senha</span>
                <span className={styles.inputComIcone}>
                  <Lock size={16} />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(evento) => setSenha(evento.target.value)}
                    placeholder="Crie uma senha segura"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarSenha((atual) => !atual)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>

              <label className={styles.campo}>
                <span className={styles.rotulo}>Confirmar senha</span>
                <span className={styles.inputComIcone}>
                  <Lock size={16} />
                  <input
                    type={mostrarConfirmarSenha ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(evento) => setConfirmarSenha(evento.target.value)}
                    placeholder="Confirme sua senha"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarConfirmarSenha((atual) => !atual)}
                    aria-label={mostrarConfirmarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
            </div>

            {!modoCredenciada ? (
              <div className={styles.blocoPlanos}>
                <div className={styles.separadorTexto}>
                  <span>Escolha seu plano</span>
                </div>
                <div className={styles.gradePlanos}>
                  {planos.map((plano, indice) => (
                    <button
                      type="button"
                      key={plano.id}
                      onClick={() => setPlanoSelecionadoId(plano.id)}
                      className={`${styles.cardPlano} ${planoSelecionadoId === plano.id ? styles.cardPlanoSelecionado : ''}`}
                    >
                      {indice === Math.min(1, planos.length - 1) && (
                        <span className={styles.seloPlano}>Mais escolhido</span>
                      )}
                      <span className={styles.radioPlano} aria-hidden="true" />
                      <span className={styles.nomePlano}>{plano.nome}</span>
                      <span className={styles.precoPlano}>
                        {plano.preco_mensal == null || Number(plano.preco_mensal) === 0
                          ? 'Grátis'
                          : `R$ ${Number(plano.preco_mensal).toFixed(0)}`}
                        {plano.preco_mensal > 0 && <span className={styles.precoPeriodo}>/mês</span>}
                      </span>
                      <ul className={styles.listaRecursosPlano}>
                        <li>
                          <Check size={12} /> Histórico de {plano.dias_historico} dias
                        </li>
                        <li>
                          <Check size={12} />{' '}
                          {plano.max_estacoes ? `Até ${plano.max_estacoes} estação(ões)` : 'Estações ilimitadas'}
                        </li>
                        {plano.funcionalidades_detalhe.slice(0, 3).map((funcionalidade) => (
                          <li key={funcionalidade.id}>
                            <Check size={12} /> {funcionalidade.nome}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <label className={styles.campo}>
                <span className={styles.rotulo}>Token de credenciamento</span>
                <span className={styles.inputComIcone}>
                  <KeyRound size={16} />
                  <input
                    type="password"
                    value={tokenCredenciamento}
                    onChange={(evento) => setTokenCredenciamento(evento.target.value)}
                    placeholder="Token da organização"
                    required
                  />
                </span>
              </label>
            )}

            {erro && <p className={styles.erro}>{erro}</p>}

            <button type="submit" className={styles.botaoPrincipal} disabled={carregando}>
              {carregando ? 'Criando...' : modoCredenciada ? 'Criar conta credenciada' : 'Criar conta'}
              {!carregando && <ArrowRight size={16} />}
            </button>

            <div className={styles.divisorOu}>
              <span>ou</span>
            </div>

            {modoCredenciada ? (
              <button type="button" className={styles.opcaoCredenciada} onClick={() => setModoCredenciada(false)}>
                <ArrowLeft size={18} />
                <span className={styles.opcaoCredenciadaTexto}>
                  <strong>Voltar para cadastro normal</strong>
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={styles.opcaoCredenciada}
                onClick={() => setModoCredenciada(true)}
              >
                <KeyRound size={18} />
                <span className={styles.opcaoCredenciadaTexto}>
                  <strong>Tenho um token de credenciamento</strong>
                  <small>Acesso para administradores e equipes</small>
                </span>
              </button>
            )}

            <p className={styles.linkLogin}>
              Já tem uma conta? <Link to="/login">Fazer login</Link>
            </p>
          </form>
        </main>
      </div>
    </div>
  )
}

export default Cadastro
