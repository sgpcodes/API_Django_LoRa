import { useEffect, useMemo, useState } from 'react'
import {
  Grid2x2,
  List,
  Plus,
  Search,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import ContaAdminCard from '../components/ContaAdminCard'
import NovaContaForm from '../components/NovaContaForm'
import StatusMessage from '../components/StatusMessage'
import {
  atualizarConta,
  buscarContas,
  criarConta,
  excluirConta,
  reativarConta,
  suspenderConta,
} from '../services/contasAdminService'
import { atribuirEstacao, atualizarUsuariosEstacao, buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import styles from './ContasAdmin.module.css'

const POR_PAGINA = 10

const ABAS_PLANO = [
  { valor: 'todas', rotulo: 'Todas as contas', icone: Users },
  { valor: 'Standard', rotulo: 'Standard', icone: UserRound },
  { valor: 'Pro', rotulo: 'Pro', icone: UserCog },
  { valor: 'Plus', rotulo: 'Plus', icone: UserCog },
]

// Tela "Contas" do Painel Administrativo: uma conta Standard/Pro/Plus por
// card, expansível. Além de atribuir estação, dá pra editar os dados,
// suspender/reativar, excluir (bloqueado no backend se ainda tiver
// estação vinculada) e criar contas novas na mão.
function ContasAdmin() {
  const [contas, setContas] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState(null)

  const [processandoId, setProcessandoId] = useState(null)
  const [erroPorConta, setErroPorConta] = useState({})

  const [abaPlano, setAbaPlano] = useState('todas')
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('recentes')
  const [visualizacao, setVisualizacao] = useState('lista')
  const [pagina, setPagina] = useState(1)
  const [mostrarNovaConta, setMostrarNovaConta] = useState(false)

  async function carregar() {
    try {
      const [dadosContas, dadosEstacoes, dadosOrfaos] = await Promise.all([
        buscarContas(),
        buscarEstacoes(),
        buscarSensoresOrfaos(),
      ])
      setContas(dadosContas)
      setEstacoes(dadosEstacoes)
      setOrfaos(dadosOrfaos)
      setErroCarga(null)
    } catch {
      setErroCarga('Não foi possível carregar as contas agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  // Uma estação pode ter várias contas vinculadas ao mesmo tempo (RN15),
  // então ela aparece na lista de TODAS elas, não só de uma.
  const estacoesPorConta = useMemo(() => {
    const mapa = new Map()
    estacoes.forEach((estacao) => {
      estacao.usuarios.forEach((contaId) => {
        const lista = mapa.get(contaId) ?? []
        lista.push(estacao)
        mapa.set(contaId, lista)
      })
    })
    return mapa
  }, [estacoes])

  const contadorPorPlano = useMemo(() => {
    const contador = { todas: contas.length, Standard: 0, Pro: 0, Plus: 0 }
    contas.forEach((conta) => {
      if (conta.plano_atual && contador[conta.plano_atual] != null) contador[conta.plano_atual] += 1
    })
    return contador
  }, [contas])

  const contasVisiveis = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase()
    let lista = contas.filter((conta) => (abaPlano === 'todas' ? true : conta.plano_atual === abaPlano))
    if (buscaNormalizada) {
      lista = lista.filter((conta) => {
        const nome = `${conta.first_name} ${conta.last_name}`.toLowerCase()
        return (
          nome.includes(buscaNormalizada) ||
          conta.email?.toLowerCase().includes(buscaNormalizada) ||
          conta.username?.toLowerCase().includes(buscaNormalizada)
        )
      })
    }
    lista = [...lista].sort((a, b) => {
      if (ordenacao === 'nome') {
        return (a.first_name || a.username).localeCompare(b.first_name || b.username)
      }
      return new Date(b.date_joined) - new Date(a.date_joined)
    })
    return lista
  }, [contas, abaPlano, busca, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(contasVisiveis.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const contasDaPagina = contasVisiveis.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA)

  function mudarFiltro(atualizar) {
    atualizar()
    setPagina(1)
  }

  async function executarAcao(contaId, acao) {
    setProcessandoId(contaId)
    setErroPorConta((atual) => ({ ...atual, [contaId]: null }))
    try {
      await acao()
      await carregar()
      return true
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem =
        dados?.usuarios?.[0] ??
        dados?.identificador?.[0] ??
        dados?.email?.[0] ??
        dados?.detail ??
        dados?.non_field_errors?.[0] ??
        'Não foi possível concluir. Tente de novo.'
      setErroPorConta((atual) => ({ ...atual, [contaId]: mensagem }))
      return false
    } finally {
      setProcessandoId(null)
    }
  }

  const aoAtribuir = (contaId, sensorId) =>
    executarAcao(contaId, () => atribuirEstacao({ identificador: sensorId, usuarioIds: [contaId] }))

  const aoSalvarEdicao = (contaId, dados) => executarAcao(contaId, () => atualizarConta(contaId, dados))

  const aoSuspenderOuReativar = (conta) =>
    executarAcao(conta.id, () => (conta.is_active ? suspenderConta(conta.id) : reativarConta(conta.id)))

  const aoExcluir = (contaId) => executarAcao(contaId, () => excluirConta(contaId))

  // Desvincula só esta conta da estação (não apaga a estação nem afeta
  // as outras contas que também estejam vinculadas a ela).
  const aoRemoverEstacaoDaLista = (contaId, estacao) =>
    executarAcao(contaId, () => atualizarUsuariosEstacao(estacao.id, estacao.usuarios.filter((id) => id !== contaId)))

  async function aoCriarConta(campos) {
    await criarConta(campos)
    await carregar()
    setMostrarNovaConta(false)
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando contas..." />
      </div>
    )
  }

  if (erroCarga) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto={erroCarga} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Users size={20} />
            Contas
          </h1>
          <p className={styles.subtitulo}>Gerencie todas as contas cadastradas na plataforma.</p>
        </div>
        <button type="button" className={styles.botaoNovaConta} onClick={() => setMostrarNovaConta((m) => !m)}>
          <Plus size={16} />
          Nova conta
        </button>
      </div>

      {mostrarNovaConta && <NovaContaForm onCriar={aoCriarConta} onFechar={() => setMostrarNovaConta(false)} />}

      <div className={styles.barraFiltros}>
        <div className={styles.abas}>
          {ABAS_PLANO.map((aba) => (
            <button
              key={aba.valor}
              type="button"
              className={`${styles.aba} ${abaPlano === aba.valor ? styles.abaAtiva : ''}`}
              onClick={() => mudarFiltro(() => setAbaPlano(aba.valor))}
            >
              <aba.icone size={14} />
              {aba.rotulo}
              <span className={styles.abaContador}>{contadorPorPlano[aba.valor] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.controles}>
          <select
            className={styles.seletorOrdenacao}
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
          >
            <option value="recentes">Mais recentes</option>
            <option value="nome">Nome (A-Z)</option>
          </select>

          <div className={styles.campoBusca}>
            <Search size={14} />
            <input
              className={styles.inputBusca}
              placeholder="Buscar por nome, e-mail ou usuário..."
              value={busca}
              onChange={(e) => mudarFiltro(() => setBusca(e.target.value))}
            />
          </div>

          <div className={styles.toggleVisualizacao}>
            <button
              type="button"
              className={visualizacao === 'lista' ? styles.toggleAtivo : ''}
              onClick={() => setVisualizacao('lista')}
              aria-label="Visualização em lista"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className={visualizacao === 'grade' ? styles.toggleAtivo : ''}
              onClick={() => setVisualizacao('grade')}
              aria-label="Visualização em grade"
            >
              <Grid2x2 size={15} />
            </button>
          </div>
        </div>
      </div>

      <p className={styles.resultados}>{contasVisiveis.length} conta(s) encontrada(s)</p>

      {contasVisiveis.length === 0 ? (
        <p className={styles.semDados}>Nenhuma conta encontrada.</p>
      ) : (
        <div className={visualizacao === 'grade' ? styles.grade : styles.lista}>
          {contasDaPagina.map((conta) => (
            <ContaAdminCard
              key={conta.id}
              conta={conta}
              estacoesDaConta={estacoesPorConta.get(conta.id) ?? []}
              sensoresOrfaos={orfaos}
              processando={processandoId === conta.id}
              erro={erroPorConta[conta.id]}
              onAtribuir={(sensorId) => aoAtribuir(conta.id, sensorId)}
              onSalvarEdicao={(dados) => aoSalvarEdicao(conta.id, dados)}
              onSuspenderOuReativar={() => aoSuspenderOuReativar(conta)}
              onExcluir={() => aoExcluir(conta.id)}
              onRemoverEstacaoDaLista={(estacao) => aoRemoverEstacaoDaLista(conta.id, estacao)}
            />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className={styles.paginacao}>
          <button
            type="button"
            className={styles.botaoPagina}
            disabled={paginaSegura === 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span className={styles.paginaAtual}>
            Página {paginaSegura} de {totalPaginas}
          </span>
          <button
            type="button"
            className={styles.botaoPagina}
            disabled={paginaSegura === totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}

export default ContasAdmin
