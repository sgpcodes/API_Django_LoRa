import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { buscarPlanos } from '../services/planosService'
import styles from './NovaContaForm.module.css'

const CAMPOS_INICIAIS = { nome: '', sobrenome: '', email: '', telefone: '', senha: '', planoId: '' }

// Painel inline (sem modal — mesmo padrão do resto do app) pra o admin
// criar uma conta Standard/Pro/Plus na mão, sem passar pelo cadastro
// público/confirmação de e-mail.
function NovaContaForm({ onCriar, onFechar }) {
  const [planos, setPlanos] = useState([])
  const [campos, setCampos] = useState(CAMPOS_INICIAIS)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    buscarPlanos()
      .then((dados) => {
        const ativos = dados.filter((p) => p.ativo).sort((a, b) => a.ordem - b.ordem)
        setPlanos(ativos)
        setCampos((c) => ({ ...c, planoId: ativos[0]?.id ?? '' }))
      })
      .catch(() => setErro('Não foi possível carregar os planos.'))
  }, [])

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro(null)
    setSalvando(true)
    try {
      await onCriar(campos)
      setCampos((c) => ({ ...CAMPOS_INICIAIS, planoId: c.planoId }))
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem =
        dados?.email?.[0] ?? dados?.username?.[0] ?? dados?.password?.[0] ?? dados?.detail ?? 'Não foi possível criar a conta.'
      setErro(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className={styles.painel} onSubmit={aoEnviar}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>Nova conta</h2>
        <button type="button" className={styles.botaoFechar} onClick={onFechar} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className={styles.grade}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            className={styles.input}
            required
            value={campos.nome}
            onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Sobrenome</span>
          <input
            className={styles.input}
            value={campos.sobrenome}
            onChange={(e) => setCampos((c) => ({ ...c, sobrenome: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>E-mail</span>
          <input
            className={styles.input}
            type="email"
            required
            value={campos.email}
            onChange={(e) => setCampos((c) => ({ ...c, email: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Telefone</span>
          <input
            className={styles.input}
            value={campos.telefone}
            onChange={(e) => setCampos((c) => ({ ...c, telefone: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Senha provisória</span>
          <input
            className={styles.input}
            type="text"
            required
            minLength={8}
            placeholder="Mín. 8 caracteres"
            value={campos.senha}
            onChange={(e) => setCampos((c) => ({ ...c, senha: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Plano</span>
          <select
            className={styles.input}
            required
            value={campos.planoId}
            onChange={(e) => setCampos((c) => ({ ...c, planoId: e.target.value }))}
          >
            {planos.map((plano) => (
              <option key={plano.id} value={plano.id}>
                {plano.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className={styles.aviso}>{erro}</p>}

      <div className={styles.linhaBotoes}>
        <button type="submit" className={styles.botaoCriar} disabled={salvando}>
          {salvando ? 'Criando...' : 'Criar conta'}
        </button>
        <button type="button" className={styles.botaoCancelar} onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default NovaContaForm
