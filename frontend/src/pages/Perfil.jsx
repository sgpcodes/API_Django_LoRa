import { useEffect, useState } from 'react'
import { User, Check, KeyRound } from 'lucide-react'
import { buscarMeuPerfil, atualizarMeuPerfil, trocarMinhaSenha } from '../services/perfilService'
import styles from './Perfil.module.css'

// Tela de Perfil (2.2.2.3 do PDF): formulário de dados pessoais e troca de
// senha (com confirmação da senha atual, RN08). Dados vêm de verdade do
// backend (UsuarioViewSet) — não é mock.
function Perfil() {
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const [nome, setNome] = useState('')
  const [sobrenome, setSobrenome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [dadosSalvos, setDadosSalvos] = useState(false)
  const [erroDados, setErroDados] = useState('')

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [senhaTrocada, setSenhaTrocada] = useState(false)
  const [erroSenha, setErroSenha] = useState('')

  useEffect(() => {
    buscarMeuPerfil()
      .then((dados) => {
        setPerfil(dados)
        setNome(dados.first_name)
        setSobrenome(dados.last_name)
        setEmail(dados.email)
        setTelefone(dados.telefone ?? '')
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
      })
      setPerfil(atualizado)
      setDadosSalvos(true)
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
      setTimeout(() => setSenhaTrocada(false), 2500)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      setErroSenha(dados?.senha_atual?.[0] || dados?.password?.[0] || 'Não foi possível trocar a senha.')
    } finally {
      setTrocandoSenha(false)
    }
  }

  if (carregando) {
    return <div className={styles.pagina}>Carregando perfil...</div>
  }

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>
        <User size={20} />
        Perfil
      </h1>

      <form className={styles.cartao} onSubmit={aoSalvarDados}>
        <h2 className={styles.tituloSecao}>Dados pessoais</h2>

        <div className={styles.linha2Colunas}>
          <div>
            <label className={styles.rotulo}>Nome</label>
            <input className={styles.campo} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className={styles.rotulo}>Sobrenome</label>
            <input className={styles.campo} value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
          </div>
        </div>

        <label className={styles.rotulo}>E-mail cadastrado</label>
        <input className={styles.campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className={styles.rotulo}>Telefone</label>
        <input className={styles.campo} value={telefone} onChange={(e) => setTelefone(e.target.value)} />

        <label className={styles.rotulo}>Login de acesso</label>
        <input className={styles.campo} value={perfil.username} disabled />

        {erroDados && <p className={styles.erro}>{erroDados}</p>}

        <button type="submit" className={styles.botaoPrimario} disabled={salvandoDados}>
          {dadosSalvos ? (
            <>
              <Check size={16} />
              Salvo com sucesso
            </>
          ) : salvandoDados ? (
            'Salvando...'
          ) : (
            'Salvar dados'
          )}
        </button>
      </form>

      <form className={styles.cartao} onSubmit={aoTrocarSenha}>
        <h2 className={styles.tituloSecao}>
          <KeyRound size={16} />
          Alterar senha
        </h2>

        <label className={styles.rotulo}>Senha atual</label>
        <input
          className={styles.campo}
          type="password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          required
        />

        <label className={styles.rotulo}>Nova senha</label>
        <input
          className={styles.campo}
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          minLength={8}
          required
        />

        {erroSenha && <p className={styles.erro}>{erroSenha}</p>}

        <button type="submit" className={styles.botaoSecundario} disabled={trocandoSenha}>
          {senhaTrocada ? (
            <>
              <Check size={16} />
              Senha alterada
            </>
          ) : trocandoSenha ? (
            'Alterando...'
          ) : (
            'Alterar senha'
          )}
        </button>
      </form>
    </div>
  )
}

export default Perfil
