import { useState } from 'react'
import { Bell, ChevronDown, Calendar, Sun, Moon } from 'lucide-react'
import styles from './Header.module.css'

const OPCOES_PERIODO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

// Cabeçalho fixo no topo do conteúdo: saudação, seletor de período (dropdown)
// e as ações do usuário (notificações, perfil). O nome do usuário está fixo
// por enquanto — o projeto ainda não tem sistema de login.
function Header({
  periodo,
  onEscolherPeriodo,
  dataInicio,
  dataFim,
  onAplicarPersonalizado,
  tema,
  onAlternarTema,
}) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [rascunhoInicio, setRascunhoInicio] = useState(dataInicio)
  const [rascunhoFim, setRascunhoFim] = useState(dataFim)

  const rotuloAtual = OPCOES_PERIODO.find((opcao) => opcao.valor === periodo)?.rotulo ?? 'Hoje'

  function escolher(valor) {
    onEscolherPeriodo(valor)
    if (valor !== 'personalizado') {
      setMenuAberto(false)
    }
  }

  return (
    <header className={styles.cabecalho}>
      <div className={styles.boasVindas}>
        <h1 className={styles.titulo}>Bem-vindo ao sistema de monitoramento meteorológico!</h1>
        <p className={styles.subtitulo}>Acompanhe em tempo real os dados coletados pelos sensores.</p>
      </div>

      <div className={styles.acoes}>
        <div className={styles.seletorPeriodo}>
          <button
            type="button"
            className={styles.botaoPeriodo}
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            <Calendar size={16} />
            {rotuloAtual}
            <ChevronDown size={14} />
          </button>

          {menuAberto && (
            <div className={styles.menuPeriodo}>
              {OPCOES_PERIODO.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  className={`${styles.itemMenu} ${periodo === opcao.valor ? styles.itemMenuAtivo : ''}`}
                  onClick={() => escolher(opcao.valor)}
                >
                  {opcao.rotulo}
                </button>
              ))}

              {periodo === 'personalizado' && (
                <div className={styles.personalizado}>
                  <label className={styles.campoData}>
                    <span>De</span>
                    <input
                      type="date"
                      value={rascunhoInicio}
                      max={rascunhoFim}
                      onChange={(evento) => setRascunhoInicio(evento.target.value)}
                    />
                  </label>
                  <label className={styles.campoData}>
                    <span>Até</span>
                    <input
                      type="date"
                      value={rascunhoFim}
                      min={rascunhoInicio}
                      onChange={(evento) => setRascunhoFim(evento.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.botaoAplicar}
                    onClick={() => {
                      onAplicarPersonalizado(rascunhoInicio, rascunhoFim)
                      setMenuAberto(false)
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.temaBotoes}>
          <button
            type="button"
            className={`${styles.temaBotao} ${tema === 'dia' ? styles.temaBotaoAtivo : ''}`}
            onClick={() => tema !== 'dia' && onAlternarTema()}
            aria-label="Tema claro"
          >
            <Sun size={15} />
          </button>
          <button
            type="button"
            className={`${styles.temaBotao} ${tema === 'noite' ? styles.temaBotaoAtivo : ''}`}
            onClick={() => tema !== 'noite' && onAlternarTema()}
            aria-label="Tema escuro"
          >
            <Moon size={15} />
          </button>
        </div>

        <button type="button" className={styles.botaoIcone} aria-label="Notificações">
          <Bell size={18} />
        </button>

        <button type="button" className={styles.perfil}>
          <span className={styles.avatar}>SG</span>
          <span className={styles.nomePerfil}>Sara Gonçalves</span>
          <ChevronDown size={14} />
        </button>
      </div>
    </header>
  )
}

export default Header
