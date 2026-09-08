import { useState } from 'react'
import { X } from 'lucide-react'
import styles from './NovaContaForm.module.css'

const CAMPOS_INICIAIS = {
  identificador: '',
  nome: '',
  localizacao: '',
  usuarioIds: [],
}

// Painel inline (mesmo padrão de NovaContaForm.jsx) pra o admin cadastrar
// uma estação antes do hardware ter mandado qualquer leitura — em vez de
// esperar aparecer como "sensor órfão" pra só então poder ser atribuída.
function NovaEstacaoForm({ contas, onCriar, onFechar }) {
  const [campos, setCampos] = useState(CAMPOS_INICIAIS)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro(null)
    if (campos.usuarioIds.length === 0) {
      setErro('Selecione ao menos uma conta.')
      return
    }
    setSalvando(true)
    try {
      await onCriar(campos)
      setCampos(CAMPOS_INICIAIS)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem =
        dados?.identificador?.[0] ?? dados?.usuarios?.[0] ?? dados?.detail ?? 'Não foi possível cadastrar a estação.'
      setErro(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className={styles.painel} onSubmit={aoEnviar}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>Nova estação</h2>
        <button type="button" className={styles.botaoFechar} onClick={onFechar} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      <div className={styles.grade}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Identificador</span>
          <input
            className={styles.input}
            required
            placeholder="Ex.: ESP32_03"
            value={campos.identificador}
            onChange={(e) => setCampos((c) => ({ ...c, identificador: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            className={styles.input}
            placeholder="Nome amigável"
            value={campos.nome}
            onChange={(e) => setCampos((c) => ({ ...c, nome: e.target.value }))}
          />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Localização</span>
          <input
            className={styles.input}
            placeholder="Ex.: Área de Plantio - Talhão 2"
            value={campos.localizacao}
            onChange={(e) => setCampos((c) => ({ ...c, localizacao: e.target.value }))}
          />
        </label>
      </div>

      <div className={styles.campo}>
        <span className={styles.rotulo}>Contas vinculadas ({campos.usuarioIds.length} selecionada(s))</span>
        <div className={styles.checklist}>
          {contas.length === 0 ? (
            <p className={styles.checklistVazio}>Nenhuma conta cadastrada ainda.</p>
          ) : (
            contas.map((conta) => (
              <label key={conta.id} className={styles.checklistItem}>
                <input
                  type="checkbox"
                  checked={campos.usuarioIds.includes(conta.id)}
                  onChange={(e) =>
                    setCampos((c) => ({
                      ...c,
                      usuarioIds: e.target.checked
                        ? [...c.usuarioIds, conta.id]
                        : c.usuarioIds.filter((id) => id !== conta.id),
                    }))
                  }
                />
                {conta.first_name || conta.username} ({conta.plano_atual ?? 'sem plano'})
              </label>
            ))
          )}
        </div>
      </div>

      {erro && <p className={styles.aviso}>{erro}</p>}

      <div className={styles.linhaBotoes}>
        <button type="submit" className={styles.botaoCriar} disabled={salvando}>
          {salvando ? 'Cadastrando...' : 'Cadastrar estação'}
        </button>
        <button type="button" className={styles.botaoCancelar} onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default NovaEstacaoForm
