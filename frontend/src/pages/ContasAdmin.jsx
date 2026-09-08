import { useEffect, useMemo, useState } from 'react'
import {
  Crown,
  Grid2x2,
  List,
  Plus,
  Search,
  Users,
  UsersRound,
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
  { valor: 'todas', rotulo: 'Todas as contas', icone: Users, cor: 'abaCorNeutra' },
  { valor: 'Standard', rotulo: 'Standard', icone: Users, cor: 'abaCorAzul' },
  { valor: 'Pro', rotulo: 'Pro', icone: UsersRound, cor: 'abaCorVerde' },
  { valor: 'Plus', rotulo: 'Plus', icone: Crown, cor: 'abaCorRoxa' },
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

  // Sensor ainda não cadastrado (órfão): cria a Estacao já vinculada a
  // esta conta.
  const aoAtribuir = (contaId, sensorId) =>
    executarAcao(contaId, () => atribuirEstacao({ identificador: sensorId, usuarioIds: [contaId] }))

  // Estação já cadastrada (com ou sem outras contas vinculadas): só
  // adiciona esta conta à lista existente — não mexe em quem já estava lá
  // (RN15: uma estação pode ter quantas contas o Gestor quiser).
  const aoVincularEstacaoExistente = (contaId, estacao) =>
    executarAcao(contaId, () => atualizarUsuariosEstacao(estacao.id, [...estacao.usuarios, contaId]))

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
      <div className={styles.banner}>
        <div className={styles.bannerRede} aria-hidden="true">
          <svg viewBox="0 0 420 200" preserveAspectRatio="xMidYMid slice">
            <circle cx="310" cy="90" r="78" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            <circle cx="310" cy="90" r="55" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            <line x1="232" y1="90" x2="388" y2="90" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <line x1="310" y1="12" x2="310" y2="168" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <g stroke="rgba(147,197,253,0.55)" strokeWidth="1">
              <line x1="270" y1="55" x2="340" y2="40" />
              <line x1="340" y1="40" x2="375" y2="85" />
              <line x1="270" y1="55" x2="255" y2="110" />
              <line x1="255" y1="110" x2="300" y2="150" />
              <line x1="300" y1="150" x2="365" y2="135" />
              <line x1="365" y1="135" x2="375" y2="85" />
              <line x1="270" y1="55" x2="375" y2="85" />
            </g>
            <g fill="#93c5fd">
              <circle cx="270" cy="55" r="3.5" />
              <circle cx="340" cy="40" r="3" />
              <circle cx="375" cy="85" r="4" />
              <circle cx="255" cy="110" r="3" />
              <circle cx="300" cy="150" r="3.5" />
              <circle cx="365" cy="135" r="3" />
            </g>
          </svg>
        </div>
        <div className={styles.bannerConteudo}>
          <div className={styles.bannerIcone}>
            <Users size={26} />
          </div>
          <div>
            <h1 className={styles.bannerTitulo}>Contas</h1>
            <p className={styles.bannerSubtitulo}>
              Gerencie todas as contas cadastradas no sistema. Acompanhe o plano, status e configure permissões e
              estações atribuídas.
            </p>
          </div>
        </div>
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
              <aba.icone size={14} className={styles[aba.cor]} />
              {aba.rotulo} ({contadorPorPlano[aba.valor] ?? 0})
            </button>
          ))}
        </div>

        <div className={styles.controles}>
          <label className={styles.campoOrdenacao}>
            <span className={styles.rotuloControle}>Ordenar por</span>
            <select
              className={styles.seletorOrdenacao}
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
            >
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome (A-Z)</option>
            </select>
          </label>

          <div className={styles.campoBusca}>
            <input
              className={styles.inputBusca}
              placeholder="Buscar por nome, e-mail ou usuário..."
              value={busca}
              onChange={(e) => mudarFiltro(() => setBusca(e.target.value))}
            />
            <Search size={14} />
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

          <button type="button" className={styles.botaoNovaConta} onClick={() => setMostrarNovaConta((m) => !m)}>
            <Plus size={16} />
            Nova conta
          </button>
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
              todasEstacoes={estacoes}
              processando={processandoId === conta.id}
              erro={erroPorConta[conta.id]}
              onAtribuir={(sensorId) => aoAtribuir(conta.id, sensorId)}
              onVincularEstacaoExistente={(estacao) => aoVincularEstacaoExistente(conta.id, estacao)}
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
