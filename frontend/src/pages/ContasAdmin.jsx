import { useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import ContaAdminCard from '../components/ContaAdminCard'
import StatusMessage from '../components/StatusMessage'
import { buscarContas } from '../services/contasAdminService'
import { atribuirEstacao, buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import styles from './ContasAdmin.module.css'

// Tela "Contas" do Painel Administrativo: uma conta Standard/Pro/Plus por
// card, expansível (mesmo padrão das outras telas do admin). É daqui que
// o admin atribui uma estação (sensor sem dono) a uma conta — seletor
// rápido dentro do próprio card, sem precisar ir até a tela de Estações.
function ContasAdmin() {
  const [contas, setContas] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [atribuindoPara, setAtribuindoPara] = useState(null)
  const [erroAtribuicaoPara, setErroAtribuicaoPara] = useState({})

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
      setErro(null)
    } catch {
      setErro('Não foi possível carregar as contas agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const estacoesPorConta = useMemo(() => {
    const mapa = new Map()
    estacoes.forEach((estacao) => {
      const lista = mapa.get(estacao.dono) ?? []
      lista.push(estacao)
      mapa.set(estacao.dono, lista)
    })
    return mapa
  }, [estacoes])

  async function aoAtribuir(contaId, sensorId) {
    setAtribuindoPara(contaId)
    setErroAtribuicaoPara((atual) => ({ ...atual, [contaId]: null }))
    try {
      await atribuirEstacao({ identificador: sensorId, donoId: contaId })
      await carregar()
    } catch (erroRequisicao) {
      const mensagem =
        erroRequisicao.response?.data?.dono?.[0] ??
        erroRequisicao.response?.data?.identificador?.[0] ??
        erroRequisicao.response?.data?.non_field_errors?.[0] ??
        'Não foi possível atribuir a estação. Tente de novo.'
      setErroAtribuicaoPara((atual) => ({ ...atual, [contaId]: mensagem }))
    } finally {
      setAtribuindoPara(null)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando contas..." />
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
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Users size={20} />
            Contas
          </h1>
          <p className={styles.subtitulo}>Contas Standard, Pro e Plus cadastradas — atribua estações direto por aqui.</p>
        </div>
        <span className={styles.resumoItem}>
          <strong>{contas.length}</strong> conta(s)
        </span>
      </div>

      {contas.length === 0 ? (
        <p className={styles.semDados}>Nenhuma conta cadastrada ainda.</p>
      ) : (
        <div className={styles.lista}>
          {contas.map((conta) => (
            <ContaAdminCard
              key={conta.id}
              conta={conta}
              estacoesDaConta={estacoesPorConta.get(conta.id) ?? []}
              sensoresOrfaos={orfaos}
              atribuindo={atribuindoPara === conta.id}
              erro={erroAtribuicaoPara[conta.id]}
              onAtribuir={(sensorId) => aoAtribuir(conta.id, sensorId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ContasAdmin
