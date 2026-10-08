import { useState } from 'react'
import { X } from 'lucide-react'
import { UFS } from '../services/ibgeService'
import { geocodificarCidade } from '../services/geocodingService'
import styles from './NovaContaForm.module.css'

const CAMPOS_INICIAIS = {
  tipo: 'fisica',
  identificador: '',
  nome: '',
  localizacao: '',
  cidade: '',
  uf: 'RJ',
  usuarioIds: [],
}

// Slug simples (sem acento, sem espaço) pro identificador de uma estação
// online — ela não tem hardware mandando um "sensor_id" próprio, então
// geramos um a partir do nome da cidade em vez de pedir pro Gestor
// inventar um identificador tipo "ESP32_03" que não significa nada aqui.
function slugCidade(cidade) {
  return cidade
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
    if (campos.tipo === 'online' && !campos.cidade.trim()) {
      setErro('Informe a cidade da estação online.')
      return
    }
    setSalvando(true)
    try {
      if (campos.tipo === 'online') {
        const { latitude, longitude } = await geocodificarCidade(campos.cidade, campos.uf)
        await onCriar({
          ...campos,
          identificador: `online-${slugCidade(campos.cidade)}`,
          nome: campos.nome || `Estação ${campos.cidade}`,
          localizacao: campos.localizacao || `${campos.cidade}, ${campos.uf}`,
          latitude,
          longitude,
        })
      } else {
        await onCriar(campos)
      }
      setCampos(CAMPOS_INICIAIS)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem =
        dados?.identificador?.[0] ?? dados?.usuarios?.[0] ?? dados?.latitude?.[0] ?? dados?.detail ??
        erroRequisicao.message ?? 'Não foi possível cadastrar a estação.'
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
          <span className={styles.rotulo}>Tipo</span>
          <select
            className={styles.input}
            value={campos.tipo}
            onChange={(e) => setCampos((c) => ({ ...c, tipo: e.target.value }))}
          >
            <option value="fisica">Física (hardware ESP32/LoRa)</option>
            <option value="online">Online (dados da Open-Meteo)</option>
          </select>
        </label>

        {campos.tipo === 'fisica' && (
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
        )}

        {campos.tipo === 'online' && (
          <>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Cidade</span>
              <input
                className={styles.input}
                required
                placeholder="Ex.: Niterói"
                value={campos.cidade}
                onChange={(e) => setCampos((c) => ({ ...c, cidade: e.target.value }))}
              />
            </label>
            <label className={styles.campo}>
              <span className={styles.rotulo}>UF</span>
              <select className={styles.input} value={campos.uf} onChange={(e) => setCampos((c) => ({ ...c, uf: e.target.value }))}>
                {UFS.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input
            className={styles.input}
            placeholder={campos.tipo === 'online' ? 'Padrão: "Estação <cidade>"' : 'Nome amigável'}
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
