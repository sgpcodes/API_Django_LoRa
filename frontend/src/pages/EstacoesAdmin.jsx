import { useEffect, useMemo, useState } from 'react'
import { Activity, Gem, Grid2x2, LayoutGrid, Leaf, List, Plus, Radio, Search } from 'lucide-react'
import EstacaoAdminCard from '../components/EstacaoAdminCard'
import NovaEstacaoForm from '../components/NovaEstacaoForm'
import StatusMessage from '../components/StatusMessage'
import { buscarLeituras, obterUltimaLeituraPorSensor, solicitarAnaliseRssi } from '../services/leiturasService'
import { atribuirEstacao, atualizarEstacao, buscarEstacoes, removerEstacao, trocarDonoEstacao } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import styles from './EstacoesAdmin.module.css'

const INTERVALO_ATUALIZACAO_MS = 60_000
const POR_PAGINA = 9

// Mesmo comportamento (e mesmos tempos) já definidos em DadosLora.jsx pro
// botão "Analisar": enquanto espera a resposta, confere com esse intervalo
// se o pedido pendente já foi atendido; depois de TIMEOUT_ANALISE_MS sem
// resposta, o botão volta ao normal e avisa que falhou (mesmo que o pedido
// ainda possa ser atendido depois — ver TEMPO_LIMITE_PENDENCIA no backend).
const INTERVALO_POLL_ANALISE_MS = 2_500
const TIMEOUT_ANALISE_MS = 30_000
const DURACAO_ERRO_MS = 3_000

const ABAS_PLANO = [
  { valor: 'todas', rotulo: 'Todas as estações', icone: LayoutGrid, cor: 'abaCorNeutra' },
  { valor: 'Standard', rotulo: 'Standard', icone: Activity, cor: 'abaCorAzul' },
  { valor: 'Pro', rotulo: 'Pro', icone: Leaf, cor: 'abaCorVerde' },
  { valor: 'Plus', rotulo: 'Plus', icone: Gem, cor: 'abaCorRoxa' },
]

function arredondar(valor) {
  return valor == null ? null : Number(valor.toFixed(1))
}

// Por sensor, a diferença entre a leitura mais recente e a anterior a
// ela — alimenta os selos "↑ 2.4°C" / "↓ 1 hPa" dos cards. Calculado aqui
// (não no backend) porque só é usado nesta tela.
function calcularDeltasPorSensor(leituras) {
  const porSensor = new Map()
  leituras.forEach((leitura) => {
    const lista = porSensor.get(leitura.sensor_id) ?? []
    lista.push(leitura)
    porSensor.set(leitura.sensor_id, lista)
  })

  const deltas = new Map()
  porSensor.forEach((lista, sensorId) => {
    const ordenadas = [...lista].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora))
    const [maisRecente, anterior] = ordenadas
    if (!anterior) {
      deltas.set(sensorId, { deltaTemperatura: null, deltaUmidade: null, deltaPressao: null })
      return
    }
    deltas.set(sensorId, {
      deltaTemperatura: arredondar(maisRecente.temperatura - anterior.temperatura),
      deltaUmidade: arredondar(maisRecente.umidade - anterior.umidade),
      deltaPressao:
        maisRecente.pressao != null && anterior.pressao != null
          ? arredondar(maisRecente.pressao - anterior.pressao)
          : null,
    })
  })
  return deltas
}

// Tela "Estações" do Painel Administrativo: todas as estações (ESP32) que
// já mandaram leitura, num só lugar — dados atuais, dono/plano (ou "Sem
// dono", pros sensores ainda não cadastrados) e, ao abrir "Detalhes",
// RSSI/SNR e configuração do rádio — tudo reduzido, sem precisar trocar
// de tela. Cadastrar uma estação nova (com ou sem sensor órfão) é feito
// direto aqui; editar, trocar o dono de uma já cadastrada ou remover
// também (RN15: em qualquer plano).
function EstacoesAdmin() {
  const [leituras, setLeituras] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [contas, setContas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [processandoId, setProcessandoId] = useState(null)
  const [erroPorId, setErroPorId] = useState({})

  const [abaPlano, setAbaPlano] = useState('todas')
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('nome')
  const [visualizacao, setVisualizacao] = useState('lista')
  const [pagina, setPagina] = useState(1)
  const [mostrarNovaEstacao, setMostrarNovaEstacao] = useState(false)
  const [erroNovaEstacao, setErroNovaEstacao] = useState(null)

  // Uma análise de RSSI pendente por sensor: sensorId -> { inicio }. Mesmo
  // mecanismo de DadosLora.jsx — clicar em "Atualizar leitura RSSI" num
  // dispositivo não mexe no estado dos outros.
  const [analisesPorSensor, setAnalisesPorSensor] = useState({})
  const [errosTemporarios, setErrosTemporarios] = useState({})

  function mostrarErroTemporario(sensorId, mensagem) {
    setErrosTemporarios((atual) => ({ ...atual, [sensorId]: mensagem }))
    setTimeout(() => {
      setErrosTemporarios((atual) => {
        if (!(sensorId in atual)) return atual
        const proximo = { ...atual }
        delete proximo[sensorId]
        return proximo
      })
    }, DURACAO_ERRO_MS)
  }

  async function carregar() {
    try {
      const [dadosLeituras, dadosEstacoes, dadosContas] = await Promise.all([
        buscarLeituras(),
        buscarEstacoes(),
        buscarContas(),
      ])
      setLeituras(dadosLeituras)
      setEstacoes(dadosEstacoes)
      setContas(dadosContas)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar as estações agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  // Enquanto algum sensor tem análise pendente, confere periodicamente se
  // ele já respondeu — só recarrega leituras (mais leve que o `carregar()`
  // completo, que também busca contas/estações).
  const sensoresPendentes = Object.keys(analisesPorSensor)

  useEffect(() => {
    if (sensoresPendentes.length === 0) return undefined

    const poll = setInterval(async () => {
      try {
        setLeituras(await buscarLeituras())
      } catch {
        // silencioso — o próximo poll tenta de novo.
      }
    }, INTERVALO_POLL_ANALISE_MS)

    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensoresPendentes.length])

  async function aoClicarAnalisar(sensorId) {
    setAnalisesPorSensor((atual) => ({ ...atual, [sensorId]: { inicio: Date.now() } }))
    try {
      await solicitarAnaliseRssi(sensorId)
    } catch {
      setAnalisesPorSensor((atual) => {
        const proximo = { ...atual }
        delete proximo[sensorId]
        return proximo
      })
      mostrarErroTemporario(sensorId, 'Não foi possível solicitar a análise. Tente novamente.')
    }
  }

  const dispositivos = useMemo(() => {
    const estacaoPorIdentificador = new Map(estacoes.map((estacao) => [estacao.identificador, estacao]))
    const deltasPorSensor = calcularDeltasPorSensor(leituras)

    const dosSensores = obterUltimaLeituraPorSensor(leituras).map((leitura) => {
      const estacao = estacaoPorIdentificador.get(leitura.sensor_id)
      const deltas = deltasPorSensor.get(leitura.sensor_id) ?? {}
      return {
        ...leitura,
        ...deltas,
        estacaoId: estacao?.id ?? null,
        donoId: estacao?.dono ?? null,
        nome: estacao?.nome ?? null,
        localizacao: estacao?.localizacao ?? null,
        donoNome: estacao?.dono_nome ?? null,
        donoPlano: estacao?.dono_plano ?? null,
        intervaloEnvioMinutos: estacao?.intervalo_envio_minutos ?? null,
        limiteOfflineMinutos: estacao?.limite_offline_minutos ?? null,
        ativa: estacao?.ativa ?? null,
      }
    })

    // Estações cadastradas via "Nova estação" que ainda não mandaram
    // nenhuma leitura: sem isso, ficariam invisíveis nesta tela até o
    // hardware enviar o primeiro dado.
    const identificadoresComLeitura = new Set(dosSensores.map((d) => d.sensor_id))
    const semLeituraAinda = estacoes
      .filter((estacao) => !identificadoresComLeitura.has(estacao.identificador))
      .map((estacao) => ({
        sensor_id: estacao.identificador,
        data_hora: null,
        temperatura: null,
        umidade: null,
        pressao: null,
        deltaTemperatura: null,
        deltaUmidade: null,
        deltaPressao: null,
        ultimaAnaliseRssi: null,
        ultimaConfiguracao: null,
        estacaoId: estacao.id,
        donoId: estacao.dono,
        nome: estacao.nome,
        localizacao: estacao.localizacao,
        donoNome: estacao.dono_nome,
        donoPlano: estacao.dono_plano,
        intervaloEnvioMinutos: estacao.intervalo_envio_minutos,
        limiteOfflineMinutos: estacao.limite_offline_minutos,
        ativa: estacao.ativa,
      }))

    return [...dosSensores, ...semLeituraAinda]
  }, [leituras, estacoes])

  // Toda vez que leituras novas chegam, confere se alguma análise pendente
  // já foi respondida (leitura de RSSI mais recente que o início do
  // pedido) ou estourou o tempo limite — nos dois casos, o sensor sai de
  // "pendente" (o botão volta ao normal na hora); no caso de timeout,
  // mostra a mensagem de falha por alguns segundos.
  useEffect(() => {
    if (sensoresPendentes.length === 0) return

    const agora = Date.now()
    const sensoresParaRemover = []
    const sensoresExpirados = []

    for (const sensorId of Object.keys(analisesPorSensor)) {
      const pedido = analisesPorSensor[sensorId]
      const dispositivo = dispositivos.find((d) => d.sensor_id === sensorId)
      const dataUltimaAnalise = dispositivo?.ultimaAnaliseRssi?.data_hora

      if (dataUltimaAnalise && new Date(dataUltimaAnalise).getTime() >= pedido.inicio) {
        sensoresParaRemover.push(sensorId)
      } else if (agora - pedido.inicio > TIMEOUT_ANALISE_MS) {
        sensoresParaRemover.push(sensorId)
        sensoresExpirados.push(sensorId)
      }
    }

    if (sensoresParaRemover.length > 0) {
      setAnalisesPorSensor((atual) => {
        const proximo = { ...atual }
        sensoresParaRemover.forEach((sensorId) => delete proximo[sensorId])
        return proximo
      })
    }

    sensoresExpirados.forEach((sensorId) => {
      mostrarErroTemporario(sensorId, 'O sensor não respondeu a tempo. Confira se ele está ligado e tente de novo.')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leituras])

  const contadorPorPlano = useMemo(() => {
    const contador = { todas: dispositivos.length, Standard: 0, Pro: 0, Plus: 0 }
    dispositivos.forEach((dispositivo) => {
      if (dispositivo.donoPlano && contador[dispositivo.donoPlano] != null) contador[dispositivo.donoPlano] += 1
    })
    return contador
  }, [dispositivos])

  const dispositivosVisiveis = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase()
    let lista = dispositivos.filter((d) => (abaPlano === 'todas' ? true : d.donoPlano === abaPlano))
    if (buscaNormalizada) {
      lista = lista.filter((d) => {
        return (
          (d.nome ?? '').toLowerCase().includes(buscaNormalizada) ||
          d.sensor_id.toLowerCase().includes(buscaNormalizada) ||
          (d.localizacao ?? '').toLowerCase().includes(buscaNormalizada)
        )
      })
    }
    lista = [...lista].sort((a, b) => {
      if (ordenacao === 'recentes') {
        return new Date(b.data_hora ?? 0) - new Date(a.data_hora ?? 0)
      }
      return (a.nome || a.sensor_id).localeCompare(b.nome || b.sensor_id)
    })
    return lista
  }, [dispositivos, abaPlano, busca, ordenacao])

  const totalPaginas = Math.max(1, Math.ceil(dispositivosVisiveis.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const dispositivosDaPagina = dispositivosVisiveis.slice(
    (paginaSegura - 1) * POR_PAGINA,
    paginaSegura * POR_PAGINA,
  )

  function mudarFiltro(atualizar) {
    atualizar()
    setPagina(1)
  }

  async function executarAcao(estacaoId, acao) {
    setProcessandoId(estacaoId)
    setErroPorId((atual) => ({ ...atual, [estacaoId]: null }))
    try {
      await acao()
      await carregar()
      return true
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem = dados?.dono?.[0] ?? dados?.detail ?? dados?.non_field_errors?.[0] ?? 'Não foi possível concluir. Tente de novo.'
      setErroPorId((atual) => ({ ...atual, [estacaoId]: mensagem }))
      return false
    } finally {
      setProcessandoId(null)
    }
  }

  const aoTrocarDono = (estacaoId, novoDonoId) => executarAcao(estacaoId, () => trocarDonoEstacao(estacaoId, novoDonoId))
  const aoRemover = (estacaoId) => executarAcao(estacaoId, () => removerEstacao(estacaoId))
  const aoSalvarEdicao = (estacaoId, dados) => executarAcao(estacaoId, () => atualizarEstacao(estacaoId, dados))

  async function aoCriarEstacao(campos) {
    setErroNovaEstacao(null)
    try {
      await atribuirEstacao({
        identificador: campos.identificador,
        donoId: campos.donoId,
        nome: campos.nome,
        localizacao: campos.localizacao,
      })
      await carregar()
      setMostrarNovaEstacao(false)
    } catch (erroRequisicao) {
      throw erroRequisicao
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando estações..." />
      </div>
    )
  }

  if (erro) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto={erro} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.banner}>
        <div className={styles.bannerFoto} aria-hidden="true" />
        <div className={styles.bannerConteudo}>
          <div className={styles.bannerIcone}>
            <Radio size={26} />
          </div>
          <div>
            <h1 className={styles.bannerTitulo}>Estações</h1>
            <p className={styles.bannerSubtitulo}>Gerencie todas as estações de monitoramento e configure os dispositivos.</p>
          </div>
        </div>
      </div>

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
            <select className={styles.seletorOrdenacao} value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
              <option value="nome">Nome (A-Z)</option>
              <option value="recentes">Mais recentes</option>
            </select>
          </label>

          <div className={styles.campoBusca}>
            <input
              className={styles.inputBusca}
              placeholder="Buscar por nome, ID ou local..."
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

          <button type="button" className={styles.botaoNovaEstacao} onClick={() => setMostrarNovaEstacao((m) => !m)}>
            <Plus size={16} />
            Nova estação
          </button>
        </div>
      </div>

      {mostrarNovaEstacao && (
        <NovaEstacaoForm contas={contas} onCriar={aoCriarEstacao} onFechar={() => setMostrarNovaEstacao(false)} />
      )}
      {erroNovaEstacao && <p className={styles.aviso}>{erroNovaEstacao}</p>}

      <p className={styles.resultados}>{dispositivosVisiveis.length} estação(ões) encontrada(s)</p>

      {dispositivosVisiveis.length === 0 ? (
        <p className={styles.semDados}>Nenhuma estação encontrada.</p>
      ) : (
        <div className={visualizacao === 'grade' ? styles.grade : styles.lista}>
          {dispositivosDaPagina.map((dispositivo) => (
            <EstacaoAdminCard
              key={dispositivo.sensor_id}
              dispositivo={dispositivo}
              contas={contas}
              processando={dispositivo.estacaoId != null && processandoId === dispositivo.estacaoId}
              erro={dispositivo.estacaoId != null ? erroPorId[dispositivo.estacaoId] : null}
              analisando={dispositivo.sensor_id in analisesPorSensor}
              erroAnalise={errosTemporarios[dispositivo.sensor_id] ?? null}
              onTrocarDono={(novoDonoId) => aoTrocarDono(dispositivo.estacaoId, novoDonoId)}
              onRemover={() => aoRemover(dispositivo.estacaoId)}
              onSalvarEdicao={(dados) => aoSalvarEdicao(dispositivo.estacaoId, dados)}
              onAnalisar={() => aoClicarAnalisar(dispositivo.sensor_id)}
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

export default EstacoesAdmin
