import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, LayoutDashboard, Radio, Users, Wifi, WifiOff } from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import styles from './AdminDashboard.module.css'

// Visão geral do Painel Administrativo: números agregados de estações e
// contas, só com o que os endpoints já usados nas outras abas (Estações,
// Contas) devolvem — nada de dado inventado aqui, é o mesmo total que
// aparece nas abas de contador, só reunido num só lugar como ponto de
// partida do Gestor.
function AdminDashboard() {
  const [estacoes, setEstacoes] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [contas, setContas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    Promise.all([buscarEstacoes(), buscarSensoresOrfaos(), buscarContas()])
      .then(([dadosEstacoes, dadosOrfaos, dadosContas]) => {
        setEstacoes(dadosEstacoes)
        setOrfaos(dadosOrfaos)
        setContas(dadosContas)
        setErro(null)
      })
      .catch(() => setErro('Não foi possível carregar o resumo agora.'))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando visão geral..." />
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

  const totalOnline = estacoes.filter((estacao) => !estacao.esta_offline).length
  const totalOffline = estacoes.length - totalOnline
  const contadorPlanos = { Standard: 0, Pro: 0, Plus: 0 }
  contas.forEach((conta) => {
    if (conta.plano_atual && contadorPlanos[conta.plano_atual] != null) contadorPlanos[conta.plano_atual] += 1
  })

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>
          <LayoutDashboard size={20} />
          Dashboard
        </h1>
        <p className={styles.subtitulo}>Visão geral do sistema — estações e contas cadastradas.</p>
      </div>

      <div className={styles.grade}>
        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}>
            <Radio size={20} />
          </span>
          <span className={styles.cartaoValor}>{estacoes.length}</span>
          <span className={styles.cartaoRotulo}>Estações cadastradas</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}>
            <Wifi size={20} />
          </span>
          <span className={styles.cartaoValor}>{totalOnline}</span>
          <span className={styles.cartaoRotulo}>Online agora</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVermelha}`}>
            <WifiOff size={20} />
          </span>
          <span className={styles.cartaoValor}>{totalOffline}</span>
          <span className={styles.cartaoRotulo}>Offline</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAmarela}`}>
            <AlertTriangle size={20} />
          </span>
          <span className={styles.cartaoValor}>{orfaos.length}</span>
          <span className={styles.cartaoRotulo}>Sensores sem dono</span>
        </Link>

        <Link to="/app/adm/contas" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corRoxa}`}>
            <Users size={20} />
          </span>
          <span className={styles.cartaoValor}>{contas.length}</span>
          <span className={styles.cartaoRotulo}>Contas no total</span>
        </Link>
      </div>

      <div className={styles.blocoPlanos}>
        <h2 className={styles.blocoTitulo}>Contas por plano</h2>
        <div className={styles.linhaPlanos}>
          {Object.entries(contadorPlanos).map(([plano, quantidade]) => (
            <div key={plano} className={styles.itemPlano}>
              <span className={styles.itemPlanoNome}>{plano}</span>
              <span className={styles.itemPlanoValor}>{quantidade}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
