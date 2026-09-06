import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Lock, LogIn, MailCheck, User, UserCircle2 } from 'lucide-react'
import fundoAutenticacao from '../assets/fundo-autenticacao.png'
import logoLacop from '../assets/lacop.png'
import {
  esquecerConta,
  login,
  obterClaimsDoToken,
  obterContasSalvas,
  recredenciar,
  reenviarConfirmacaoPublico,
} from '../services/authService'
import styles from './Login.module.css'

// Moldura compartilhada por todas as etapas desta página: painel com a
// imagem de fundo (a mesma do Cadastro.jsx) à esquerda, cartão da etapa
// atual à direita. Extraída aqui porque as 4 etapas abaixo, senão,
// repetiriam essa mesma casca 4 vezes.
function MolduraAuth({ children }) {
  return (
    <div className={styles.fundo} data-theme="dia">
      <div className={styles.pagina}>
        <aside
          className={styles.painelMarketing}
          style={{ backgroundImage: `url(${fundoAutenticacao})` }}
          aria-hidden="true"
        />
        <main className={styles.painelFormulario}>{children}</main>
      </div>
    </div>
  )
}

// Selo de tipo de conta na lista de contas salvas — importante quando o
// mesmo e-mail tem uma conta Gestor e uma conta Usuário (cada uma com sua
// senha): sem isso, as duas apareceriam como itens idênticos na lista.
function rotuloConta(conta) {
  if (conta.role === 'gestor') return 'Administrador'
  if (conta.plano) return conta.plano
  return 'Usuário'
}

// Porta de entrada do site — hoje é a própria rota "/" (ver App.jsx) e
// também "/login". Comportamento adaptativo por navegador:
// 0. primeiro acesso nesta máquina (nenhuma conta salva ainda): tela de
//    boas-vindas só com "Entrar" ou "Criar conta";
// 1. depois disso, já abre direto na lista de contas salvas (escolhe uma,
//    ou usa "outra conta"/"criar conta" a partir daqui);
// 2. usuário/senha (ou só senha, se uma conta salva foi escolhida);
// 3. só aparece se a conta logada precisar recredenciar (token rotacionou).
function Login() {
  const navigate = useNavigate()
  const contasSalvas = obterContasSalvas()

  const [contaEscolhida, setContaEscolhida] = useState(null) // null = ainda escolhendo/nenhuma salva
  // Começa sempre false: com conta salva, cai direto na lista (etapa 1);
  // sem conta salva, cai na tela de boas-vindas (etapa 0) — só quando a
  // pessoa clica em "Entrar" ali é que isso vira true e mostra o formulário.
  const [usandoOutraConta, setUsandoOutraConta] = useState(false)

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const [precisaRecredenciar, setPrecisaRecredenciar] = useState(false)
  const [tokenRecredenciamento, setTokenRecredenciamento] = useState('')

  // Login trava (400) enquanto o e-mail do cadastro não for confirmado —
  // guarda quem tentou entrar pra oferecer reenviar o link sem precisar
  // redigitar usuário/senha.
  const [emailNaoConfirmado, setEmailNaoConfirmado] = useState(false)
  const [contaPendente, setContaPendente] = useState('')
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  // Caso raro: a mesma senha vale pra mais de uma conta desse e-mail
  // (Gestor e Usuário, cada uma com sua senha, mas coincidiram) — guarda
  // usuário/senha pra reenviar já com o `role` escolhido (ver
  // TokenObtainPairComRoleSerializer.validate no backend).
  const [opcoesConta, setOpcoesConta] = useState(null)
  const [identificadorPendente, setIdentificadorPendente] = useState('')
  const [senhaPendente, setSenhaPendente] = useState('')

  async function autenticar(nomeDeUsuario, senhaDigitada, roleEscolhido) {
    setErro('')
    setCarregando(true)
    try {
      await login(nomeDeUsuario, senhaDigitada, roleEscolhido)
      const claims = obterClaimsDoToken()
      if (claims?.precisaRecredenciar) {
        setPrecisaRecredenciar(true)
      } else {
        navigate('/app', { replace: true })
      }
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const codigoBruto = dados?.codigo
      const codigo = Array.isArray(codigoBruto) ? codigoBruto[0] : codigoBruto
      if (codigo === 'email_nao_confirmado') {
        setContaPendente(nomeDeUsuario)
        setEmailNaoConfirmado(true)
      } else if (codigo === 'multiplas_contas') {
        setIdentificadorPendente(nomeDeUsuario)
        setSenhaPendente(senhaDigitada)
        setOpcoesConta(dados.opcoes)
      } else {
        setErro('Usuário ou senha incorretos.')
      }
    } finally {
      setCarregando(false)
    }
  }

  function aoEscolherConta(opcao) {
    setOpcoesConta(null)
    autenticar(identificadorPendente, senhaPendente, opcao.role)
  }

  async function aoReenviarConfirmacao() {
    setReenviando(true)
    try {
      await reenviarConfirmacaoPublico(contaPendente)
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  function aoEnviarComConta(evento) {
    evento.preventDefault()
    autenticar(contaEscolhida.username, senha)
  }

  function aoEnviarFormularioCompleto(evento) {
    evento.preventDefault()
    autenticar(usuario, senha)
  }

  function aoEsquecerConta(conta, evento) {
    evento.stopPropagation()
    esquecerConta(conta)
    setUsandoOutraConta(true)
  }

  async function aoEnviarRecredenciamento(evento) {
    evento.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      await recredenciar(tokenRecredenciamento)
      navigate('/app', { replace: true })
    } catch {
      setErro('Token de credenciamento inválido.')
    } finally {
      setCarregando(false)
    }
  }

  // ---- Etapa 0: primeiro acesso nesta máquina (nenhuma conta salva ainda) ----
  if (contasSalvas.length === 0 && !usandoOutraConta) {
    return (
      <MolduraAuth>
        <div className={styles.cartao}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <h1 className={styles.titulo}>Bem-vindo</h1>
          <p className={styles.subtitulo}>
            Primeiro acesso neste navegador — entre com sua conta ou crie uma nova.
          </p>

          <button type="button" className={styles.botao} onClick={() => setUsandoOutraConta(true)}>
            <LogIn size={16} />
            Entrar
          </button>
          <Link to="/cadastro" className={styles.botaoContorno}>
            Criar conta
          </Link>
        </div>
      </MolduraAuth>
    )
  }

  // ---- E-mail ainda não confirmado (login recusado) ----
  if (emailNaoConfirmado) {
    return (
      <MolduraAuth>
        <div className={styles.cartao}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <h1 className={styles.titulo}>Confirme seu e-mail</h1>
          <p className={styles.subtitulo}>
            Sua conta ainda não teve o e-mail confirmado. Verifique sua caixa de entrada (e o spam)
            e clique no link que enviamos para <strong>{contaPendente}</strong>.
          </p>

          {reenviado ? (
            <p className={styles.subtitulo}>Reenviado! Pode levar alguns minutos para chegar.</p>
          ) : (
            <button type="button" className={styles.botao} onClick={aoReenviarConfirmacao} disabled={reenviando}>
              <MailCheck size={16} />
              {reenviando ? 'Reenviando...' : 'Reenviar e-mail de confirmação'}
            </button>
          )}

          <button
            type="button"
            className={styles.linkSecundario}
            onClick={() => {
              setEmailNaoConfirmado(false)
              setReenviado(false)
              setSenha('')
            }}
          >
            Voltar
          </button>
        </div>
      </MolduraAuth>
    )
  }

  // ---- Senha vale para mais de uma conta desse e-mail: escolher qual ----
  if (opcoesConta) {
    return (
      <MolduraAuth>
        <div className={styles.cartao}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <h1 className={styles.titulo}>Qual conta é essa?</h1>
          <p className={styles.subtitulo}>
            Essa senha serve para mais de uma conta sua com o e-mail <strong>{identificadorPendente}</strong>. Escolha
            qual quer acessar.
          </p>

          <div className={styles.listaContas}>
            {opcoesConta.map((opcao) => (
              <button
                key={opcao.role}
                type="button"
                className={styles.itemConta}
                onClick={() => aoEscolherConta(opcao)}
                disabled={carregando}
              >
                <UserCircle2 size={22} />
                <span className={styles.itemContaTexto}>
                  <span>{rotuloConta(opcao)}</span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.linkSecundario}
            onClick={() => {
              setOpcoesConta(null)
              setSenha('')
            }}
          >
            Voltar
          </button>
        </div>
      </MolduraAuth>
    )
  }

  // ---- Etapa 3: precisa recredenciar (token da organização rotacionou) ----
  if (precisaRecredenciar) {
    return (
      <MolduraAuth>
        <form className={styles.cartao} onSubmit={aoEnviarRecredenciamento}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <h1 className={styles.titulo}>Credenciamento atualizado</h1>
          <p className={styles.subtitulo}>
            O token de credenciamento da organização foi trocado. Digite o novo token para
            recuperar o acesso de gestor.
          </p>

          <label className={styles.campo}>
            <span className={styles.rotulo}>Token de credenciamento</span>
            <span className={styles.inputComIcone}>
              <KeyRound size={16} />
              <input
                type="password"
                value={tokenRecredenciamento}
                onChange={(evento) => setTokenRecredenciamento(evento.target.value)}
                autoFocus
                required
              />
            </span>
          </label>

          {erro && <p className={styles.erro}>{erro}</p>}

          <button type="submit" className={styles.botao} disabled={carregando}>
            <KeyRound size={16} />
            {carregando ? 'Confirmando...' : 'Confirmar token'}
          </button>

          <button
            type="button"
            className={styles.linkSecundario}
            onClick={() => navigate('/app', { replace: true })}
          >
            Entrar sem privilégios de gestor por enquanto
          </button>
        </form>
      </MolduraAuth>
    )
  }

  // ---- Etapa 1: lista de contas salvas neste navegador ----
  if (!usandoOutraConta && !contaEscolhida) {
    return (
      <MolduraAuth>
        <div className={styles.cartao}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <h1 className={styles.titulo}>Quem está entrando?</h1>
          <p className={styles.subtitulo}>Escolha uma conta já usada neste navegador.</p>

          <div className={styles.listaContas}>
            {contasSalvas.map((conta) => (
              <button
                key={`${conta.username}::${conta.role}`}
                type="button"
                className={styles.itemConta}
                onClick={() => setContaEscolhida(conta)}
              >
                <UserCircle2 size={22} />
                <span className={styles.itemContaTexto}>
                  <span>{conta.username}</span>
                  {conta.role && <span className={styles.itemContaSelo}>{rotuloConta(conta)}</span>}
                </span>
                <span
                  className={styles.itemContaRemover}
                  onClick={(evento) => aoEsquecerConta(conta, evento)}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Esquecer conta ${conta.username}`}
                >
                  remover
                </span>
              </button>
            ))}
          </div>

          <button type="button" className={styles.linkSecundario} onClick={() => setUsandoOutraConta(true)}>
            + Usar outra conta
          </button>

          <p className={styles.linkCadastro}>
            Não tem conta? <Link to="/cadastro">Criar conta</Link>
          </p>
        </div>
      </MolduraAuth>
    )
  }

  // ---- Etapa 2 (conta salva escolhida): só a senha ----
  if (contaEscolhida) {
    return (
      <MolduraAuth>
        <form className={styles.cartao} onSubmit={aoEnviarComConta}>
          <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
          <div className={styles.contaAtual}>
            <UserCircle2 size={22} />
            <span>{contaEscolhida.username}</span>
            {contaEscolhida.role && <span className={styles.itemContaSelo}>{rotuloConta(contaEscolhida)}</span>}
          </div>

          <label className={styles.campo}>
            <span className={styles.rotulo}>Senha</span>
            <span className={styles.inputComIcone}>
              <Lock size={16} />
              <input
                type="password"
                value={senha}
                onChange={(evento) => setSenha(evento.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </span>
          </label>

          {erro && <p className={styles.erro}>{erro}</p>}

          <button type="submit" className={styles.botao} disabled={carregando}>
            <LogIn size={16} />
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            className={styles.linkSecundario}
            onClick={() => {
              setContaEscolhida(null)
              setSenha('')
              setErro('')
            }}
          >
            Não é você? Escolher outra conta
          </button>
        </form>
      </MolduraAuth>
    )
  }

  // ---- Etapa 2 (sem conta salva escolhida): formulário completo ----
  return (
    <MolduraAuth>
      <form className={styles.cartao} onSubmit={aoEnviarFormularioCompleto}>
        <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
        <h1 className={styles.titulo}>Entrar</h1>
        <p className={styles.subtitulo}>Acesso restrito à equipe gestora da plataforma.</p>

        <label className={styles.campo}>
          <span className={styles.rotulo}>Usuário ou e-mail</span>
          <span className={styles.inputComIcone}>
            <User size={16} />
            <input
              type="text"
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              autoComplete="username"
              required
            />
          </span>
        </label>

        <label className={styles.campo}>
          <span className={styles.rotulo}>Senha</span>
          <span className={styles.inputComIcone}>
            <Lock size={16} />
            <input
              type="password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              autoComplete="current-password"
              required
            />
          </span>
        </label>

        {erro && <p className={styles.erro}>{erro}</p>}

        <button type="submit" className={styles.botao} disabled={carregando}>
          <LogIn size={16} />
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>

        {contasSalvas.length > 0 && (
          <button type="button" className={styles.linkSecundario} onClick={() => setUsandoOutraConta(false)}>
            Ver contas salvas
          </button>
        )}

        <p className={styles.linkCadastro}>
          Não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </MolduraAuth>
  )
}

export default Login
