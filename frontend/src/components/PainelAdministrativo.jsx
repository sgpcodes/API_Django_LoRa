import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, Database, LayoutDashboard, LogOut, Radio, ShieldCheck, Users } from 'lucide-react'
import { logout } from '../services/authService'
import { buscarMeuPerfil } from '../services/perfilService'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import styles from './PainelAdministrativo.module.css'

const ABAS = [
  { to: '/app/adm/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { to: '/app/adm/estacoes', rotulo: 'Estações', icone: Radio },
  { to: '/app/adm/contas', rotulo: 'Contas', icone: Users },
  { to: '/app/adm/manutencao', rotulo: 'Manutenção', icone: Database },
]

const INTERVALO_ALERTAS_MS = 60_000

// Casca do Painel Administrativo (destino de quem loga como Gestor):
// cabeçalho fixo (marca, abas, alertas, conta) + tela renderizada via
// <Outlet /> em cada aba. Layout deliberadamente simples e à parte do
// tema dia/noite/cor de destaque do app do Usuário comum — é uma área
// interna, não uma vitrine.
function PainelAdministrativo() {
  const navigate = useNavigate()

  const [perfil, setPerfil] = useState(null)
  const [alertas, setAlertas] = useState([])
  const [menuAlertasAberto, setMenuAlertasAberto] = useState(false)
  const [menuContaAberto, setMenuContaAberto] = useState(false)
  const alertasRef = useRef(null)
  const contaRef = useRef(null)

  useEffect(() => {
    buscarMeuPerfil()
      .then(setPerfil)
      .catch(() => {})
  }, [])

  // Alertas = coisas que precisam de atenção do Gestor agora mesmo:
  // estações que pararam de transmitir e sensores que já mandaram leitura
  // mas ainda não têm dono. Nada de contagem inventada — os dois números
  // vêm dos mesmos endpoints que já alimentam a tela de Estações.
  useEffect(() => {
    async function carregarAlertas() {
      try {
        const [estacoes, orfaos] = await Promise.all([buscarEstacoes(), buscarSensoresOrfaos()])
        const offline = estacoes.filter((estacao) => estacao.esta_offline)
        const lista = [
          ...offline.map((estacao) => ({
            id: `offline-${estacao.id}`,
            texto: `${estacao.nome || estacao.identificador} está offline`,
          })),
          ...orfaos.map((orfao) => ({
            id: `orfao-${orfao.sensor_id}`,
            texto: `${orfao.sensor_id} enviou dados mas não tem dono`,
          })),
        ]
        setAlertas(lista)
      } catch {
        // silencioso — o sino simplesmente não atualiza neste ciclo.
      }
    }

    carregarAlertas()
    const intervalo = setInterval(carregarAlertas, INTERVALO_ALERTAS_MS)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    function aoClicarFora(evento) {
      if (alertasRef.current && !alertasRef.current.contains(evento.target)) setMenuAlertasAberto(false)
      if (contaRef.current && !contaRef.current.contains(evento.target)) setMenuContaAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  const nome = perfil ? `${perfil.first_name} ${perfil.last_name}`.trim() || perfil.username : ''
  const iniciais = nome
    ? nome
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0].toUpperCase())
        .join('')
    : ''

  return (
    <div className={styles.pagina} data-theme="dia">
      <header className={styles.cabecalho}>
        <div className={styles.marca}>
          <span className={styles.iconeMarca}>
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className={styles.titulo}>Painel administrativo</span>
            <span className={styles.subtitulo}>LACOP UFF · Monitoramento Agroclimático</span>
          </div>
        </div>

        <nav className={styles.abas}>
          {ABAS.map((aba) => (
            <NavLink
              key={aba.to}
              to={aba.to}
              className={({ isActive }) => `${styles.aba} ${isActive ? styles.abaAtiva : ''}`}
            >
              <aba.icone size={16} />
              {aba.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className={styles.areaConta}>
          <div className={styles.menuWrapper} ref={alertasRef}>
            <button
              type="button"
              className={styles.botaoIcone}
              onClick={() => setMenuAlertasAberto((a) => !a)}
              aria-label="Alertas"
            >
              <Bell size={18} />
              {alertas.length > 0 && <span className={styles.badge}>{alertas.length}</span>}
            </button>
            {menuAlertasAberto && (
              <div className={`${styles.dropdown} ${styles.dropdownAlertas}`}>
                <span className={styles.dropdownTitulo}>Alertas</span>
                {alertas.length === 0 ? (
                  <p className={styles.dropdownVazio}>Nenhum alerta no momento.</p>
                ) : (
                  <ul className={styles.listaAlertas}>
                    {alertas.map((alerta) => (
                      <li key={alerta.id}>{alerta.texto}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className={styles.menuWrapper} ref={contaRef}>
            <button type="button" className={styles.contaBotao} onClick={() => setMenuContaAberto((a) => !a)}>
              <span className={styles.avatar}>{iniciais || <ShieldCheck size={16} />}</span>
              <span className={styles.contaTextos}>
                <span className={styles.contaNome}>{nome || '—'}</span>
                <span className={styles.contaPapel}>Administrador</span>
              </span>
              <ChevronDown size={15} className={styles.contaChevron} />
            </button>
            {menuContaAberto && (
              <div className={styles.dropdown}>
                <button type="button" className={styles.dropdownItem} onClick={aoSair}>
                  <LogOut size={14} />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.conteudo}>
        <Outlet />
      </main>
    </div>
  )
}

export default PainelAdministrativo
