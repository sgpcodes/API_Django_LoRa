import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, LayoutDashboard, Radio, Users, Wifi, WifiOff } from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import styles from './AdminDashboard.module.css'

const CORES_PLANO = { Standard: 'corAzul', Pro: 'corRoxa', Plus: 'corAmarela' }

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

  const banner = (
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
          <LayoutDashboard size={26} />
        </div>
        <div>
          <h1 className={styles.bannerTitulo}>Dashboard</h1>
          <p className={styles.bannerSubtitulo}>Visão geral do sistema — estações e contas cadastradas.</p>
        </div>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {banner}
        <StatusMessage texto="Carregando visão geral..." />
      </div>
    )
  }

  if (erro) {
    return (
      <div className={styles.pagina}>
        {banner}
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
  const totalComPlano = Object.values(contadorPlanos).reduce((soma, valor) => soma + valor, 0)

  return (
    <div className={styles.pagina}>
      {banner}

      <div className={styles.grade}>
        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}>
            <Radio size={22} />
          </span>
          <span className={styles.cartaoValor}>{estacoes.length}</span>
          <span className={styles.cartaoRotulo}>Estações cadastradas</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}>
            <Wifi size={22} />
          </span>
          <span className={styles.cartaoValor}>{totalOnline}</span>
          <span className={styles.cartaoRotulo}>Online agora</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVermelha}`}>
            <WifiOff size={22} />
          </span>
          <span className={styles.cartaoValor}>{totalOffline}</span>
          <span className={styles.cartaoRotulo}>Offline</span>
        </Link>

        <Link to="/app/adm/estacoes" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAmarela}`}>
            <AlertTriangle size={22} />
          </span>
          <span className={styles.cartaoValor}>{orfaos.length}</span>
          <span className={styles.cartaoRotulo}>Sensores sem dono</span>
        </Link>

        <Link to="/app/adm/contas" className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corRoxa}`}>
            <Users size={22} />
          </span>
          <span className={styles.cartaoValor}>{contas.length}</span>
          <span className={styles.cartaoRotulo}>Contas no total</span>
        </Link>
      </div>

      <div className={styles.blocoPlanos}>
        <div className={styles.blocoPlanosCabecalho}>
          <h2 className={styles.blocoTitulo}>Contas por plano</h2>
          <Link to="/app/adm/contas" className={styles.linkVerTodas}>
            Ver todas as contas <ArrowRight size={13} />
          </Link>
        </div>
        <div className={styles.linhaPlanos}>
          {Object.entries(contadorPlanos).map(([plano, quantidade]) => {
            const proporcao = totalComPlano > 0 ? Math.round((quantidade / totalComPlano) * 100) : 0
            return (
              <div key={plano} className={styles.itemPlano}>
                <div className={styles.itemPlanoCabecalho}>
                  <span className={`${styles.pontoPlano} ${styles[CORES_PLANO[plano]]}`} />
                  <span className={styles.itemPlanoNome}>{plano}</span>
                  <span className={styles.itemPlanoValor}>{quantidade}</span>
                </div>
                <div className={styles.barraPlano}>
                  <div
                    className={`${styles.barraPlanoPreenchida} ${styles[CORES_PLANO[plano]]}`}
                    style={{ width: `${proporcao}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
