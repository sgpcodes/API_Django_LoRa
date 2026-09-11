import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, ChevronDown, Database, LayoutDashboard, LogOut, Radio, Settings, ShieldCheck, User, Users } from 'lucide-react'
import { logout } from '../services/authService'
import { buscarMeuPerfil } from '../services/perfilService'
import {
  obterCorPrincipal,
  obterIdioma,
  obterTema,
  salvarCorPrincipal,
  salvarIdioma,
  salvarTema,
  variaveisCssDaCor,
} from '../services/aparenciaService'
import styles from './PainelAdministrativo.module.css'

const ABAS = [
  { to: '/app/adm/dashboard', chave: 'dashboard', icone: LayoutDashboard },
  { to: '/app/adm/estacoes', chave: 'estacoes', icone: Radio },
  { to: '/app/adm/contas', chave: 'contas', icone: Users },
  { to: '/app/adm/manutencao', chave: 'manutencao', icone: Database },
  { to: '/app/adm/notificacoes', chave: 'notificacoes', icone: Bell },
  { to: '/app/adm/configuracoes', chave: 'configuracoes', icone: Settings },
]

// Casca do Painel Administrativo (destino de quem loga como Gestor):
// cabeçalho fixo (marca, abas, conta) + tela renderizada via <Outlet />
// em cada aba. Tema dia/noite e cor de destaque são as mesmas
// preferências que o app do Usuário comum tem (Configurações → Aparência,
// ver AdminConfiguracoes.jsx) — salvas por conta (aparenciaService.js),
// então Gestor e Usuário não pisam na preferência um do outro mesmo
// logados no mesmo navegador.
//
// Não tem mais um sino de alertas separado no cabeçalho — a aba
// "Notificações" já cobre isso; um segundo ícone de sino ao lado dela
// era redundante.
function PainelAdministrativo() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const [perfil, setPerfil] = useState(null)
  const [menuContaAberto, setMenuContaAberto] = useState(false)
  const [tema, setTema] = useState(obterTema)
  const [corPrincipal, setCorPrincipal] = useState(obterCorPrincipal)
  const [idioma, setIdioma] = useState(obterIdioma)
  const contaRef = useRef(null)

  useEffect(() => {
    i18n.changeLanguage(idioma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function mudarIdioma(valor) {
    salvarIdioma(valor)
    setIdioma(valor)
    i18n.changeLanguage(valor)
  }

  useEffect(() => {
    buscarMeuPerfil()
      .then(setPerfil)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function aoClicarFora(evento) {
      if (contaRef.current && !contaRef.current.contains(evento.target)) setMenuContaAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  // Só muda quando a pessoa clica no botão — nunca sozinho por horário.
  // Salva na hora (mesma conta, mesmo navegador), então fica assim até
  // ela trocar de novo, mesmo depois de recarregar a página.
  function alternarTema() {
    setTema((atual) => {
      const novoTema = atual === 'dia' ? 'noite' : 'dia'
      salvarTema(novoTema)
      return novoTema
    })
  }

  function mudarCorPrincipal(valor) {
    salvarCorPrincipal(valor)
    setCorPrincipal(valor)
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
    <div className={styles.pagina} data-theme={tema} style={variaveisCssDaCor(corPrincipal)}>
      <header className={styles.cabecalho}>
        <div className={styles.marca}>
          <span className={styles.iconeMarca}>
            <ShieldCheck size={20} />
          </span>
          <div>
            <span className={styles.titulo}>{t('nav.painelAdministrativo')}</span>
            <span className={styles.subtitulo}>{t('nav.lacopSubtitulo')}</span>
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
              {t(`nav.${aba.chave}`)}
            </NavLink>
          ))}
        </nav>

        <div className={styles.areaConta}>
          <div className={styles.menuWrapper} ref={contaRef}>
            <button type="button" className={styles.contaBotao} onClick={() => setMenuContaAberto((a) => !a)}>
              <span className={styles.avatar}>{iniciais || <ShieldCheck size={16} />}</span>
              <span className={styles.contaTextos}>
                <span className={styles.contaNome}>{nome || '—'}</span>
                <span className={styles.contaPapel}>{t('nav.administrador')}</span>
              </span>
              <ChevronDown size={15} className={styles.contaChevron} />
            </button>
            {menuContaAberto && (
              <div className={styles.dropdown}>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    setMenuContaAberto(false)
                    navigate('/app/adm/perfil')
                  }}
                >
                  <User size={14} />
                  {t('nav.perfil')}
                </button>
                <button type="button" className={styles.dropdownItem} onClick={aoSair}>
                  <LogOut size={14} />
                  {t('nav.sair')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.conteudo}>
        <Outlet
          context={{
            tema,
            onAlternarTema: alternarTema,
            corPrincipal,
            onMudarCorPrincipal: mudarCorPrincipal,
            idioma,
            onMudarIdioma: mudarIdioma,
          }}
        />
      </main>
    </div>
  )
}

export default PainelAdministrativo
