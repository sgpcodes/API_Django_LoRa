import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Bell,
  User,
  Settings,
  CreditCard,
  ShoppingCart,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Radio,
  X,
} from 'lucide-react'
import logoLacop from '../assets/lacop.png'
import { logout, obterClaimsDoToken } from '../services/authService'
import { obterEstacaoVinculada } from '../services/estacaoService'
import styles from './Sidebar.module.css'

// Menu da conta Standard/Pro/Plus (Seção 2.2 da especificação de fluxo).
// "Visão Geral" e "Dados do LoRa" (dashboard da estação real) saíram do
// menu, mas as páginas continuam existindo — ver pages/DashboardLora.jsx.
const ITENS_NAV = [
  { to: '/app', rotulo: 'Dashboard', icone: LayoutGrid, fim: true },
  { to: '/app/notificacoes', rotulo: 'Notificações', icone: Bell },
  { to: '/app/perfil', rotulo: 'Perfil', icone: User },
  { to: '/app/configuracoes', rotulo: 'Configurações', icone: Settings },
  { to: '/app/plano', rotulo: 'Gerenciamento de Plano', icone: CreditCard },
  { to: '/app/checkout', rotulo: 'Checkout (Upgrade)', icone: ShoppingCart },
]

// Primeiro e segundo nome dão as iniciais do avatar ("SG"); o resto do
// e-mail vira o nome exibido — mesma dedução usada no cabeçalho do
// Dashboard (ver CabecalhoStandard.jsx), até existir um endpoint "/me"
// com o nome completo de verdade.
function nomeEIniciais(username) {
  if (!username) return { nome: '—', iniciais: '—' }
  const parteLocal = username.split('@')[0]
  const palavras = parteLocal.split(/[._-]/).filter(Boolean)
  const nome = palavras.map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1)).join(' ')
  const iniciais = palavras
    .slice(0, 2)
    .map((palavra) => palavra.charAt(0).toUpperCase())
    .join('')
  return { nome, iniciais }
}

// Menu lateral: navegação entre as páginas, e atalho de tema no rodapé.
// Em telas largas, pode ser recolhida (fica só com os ícones) — recolhida,
// clicar no ícone de uma aba navega normalmente; clicar no resto da aba
// (fora do ícone) expande o menu de volta em vez de navegar. Em telas
// estreitas (≤900px, ver Sidebar.module.css) ela vira uma gaveta: some da
// tela por padrão, e "abertaMobile"/"onFecharMobile" (controlados pelo
// AppLayout) trazem ela de volta por cima do conteúdo, com um fundo
// escurecido atrás que fecha ao ser clicado.
function Sidebar({ tema, onAlternarTema, abertaMobile, onFecharMobile }) {
  const [recolhida, setRecolhida] = useState(false)
  const navigate = useNavigate()
  const estacao = obterEstacaoVinculada()
  const { nome, iniciais } = nomeEIniciais(obterClaimsDoToken()?.username)

  function aoClicarSair() {
    logout()
    navigate('/login', { replace: true })
  }

  function aoClicarAba(evento) {
    if (recolhida && !evento.target.closest(`.${styles.iconeLink}`)) {
      evento.preventDefault()
      setRecolhida(false)
      return
    }
    // No mobile, a gaveta fica por cima do conteúdo — depois de navegar,
    // não faz sentido continuar tampando a tela.
    onFecharMobile?.()
  }

  return (
    <>
      {abertaMobile && (
        <div className={styles.fundoEscurecido} onClick={onFecharMobile} aria-hidden="true" />
      )}

      <aside
        className={`${styles.sidebar} ${recolhida ? styles.sidebarRecolhida : ''} ${abertaMobile ? styles.sidebarAbertaMobile : ''}`}
      >
        <button
          type="button"
          className={styles.botaoRecolher}
          onClick={() => setRecolhida((atual) => !atual)}
          aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
        >
          {recolhida ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <button
          type="button"
          className={styles.botaoFecharMobile}
          onClick={onFecharMobile}
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>

        <div className={styles.marca}>
          <div className={styles.logoFundo}>
            <img src={logoLacop} alt="LACOP UFF" className={styles.logoMarca} />
          </div>
        </div>

        <nav className={styles.nav}>
          {ITENS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.fim}
              title={item.rotulo}
              onClick={aoClicarAba}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.linkAtivo : ''}`}
            >
              <span className={styles.iconeLink}>
                <item.icone size={18} />
              </span>
              <span className={styles.rotuloLink}>{item.rotulo}</span>
              {item.badge && <span className={styles.badgeOff}>{item.badge}</span>}
            </NavLink>
          ))}
        </nav>

        {estacao && (
          <div className={styles.cardEstacao} title={`Estação conectada: ${estacao.identificador}`}>
            <span className={styles.pontoOnline} />
            <div className={styles.cardEstacaoTexto}>
              <span className={styles.cardEstacaoTitulo}>Estação conectada</span>
              <span className={styles.cardEstacaoId}>
                <Radio size={12} />
                {estacao.identificador}
              </span>
            </div>
          </div>
        )}

        <button type="button" className={styles.contaChip} title={nome}>
          <span className={styles.avatar}>{iniciais}</span>
          <span className={styles.contaTexto}>
            <span className={styles.contaNome}>{nome}</span>
            <span className={styles.contaPlano}>Conta Standard</span>
          </span>
          <ChevronDown size={14} className={styles.contaChevron} />
        </button>

        <div className={styles.rodape}>
          <button type="button" className={styles.link} title="Ajuda">
            <HelpCircle size={18} />
            <span className={styles.rotuloLink}>Ajuda</span>
          </button>
          <button type="button" className={styles.link} title="Sair" onClick={aoClicarSair}>
            <LogOut size={18} />
            <span className={styles.rotuloLink}>Sair</span>
          </button>

          <div className={styles.temaBloco}>
            <div className={styles.temaBotoes}>
              <button
                type="button"
                className={`${styles.temaBotao} ${tema === 'dia' ? styles.temaBotaoAtivo : ''}`}
                onClick={() => tema !== 'dia' && onAlternarTema()}
                aria-label="Tema claro"
              >
                <Sun size={16} />
              </button>
              <button
                type="button"
                className={`${styles.temaBotao} ${tema === 'noite' ? styles.temaBotaoAtivo : ''}`}
                onClick={() => tema !== 'noite' && onAlternarTema()}
                aria-label="Tema escuro"
              >
                <Moon size={16} />
              </button>
            </div>
            <span className={styles.temaRotulo}>{tema === 'dia' ? 'Tema claro' : 'Tema escuro'}</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
