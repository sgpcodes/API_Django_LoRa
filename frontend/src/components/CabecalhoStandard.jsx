import { useEffect, useState } from 'react'
import { Clock, Download, ChevronDown } from 'lucide-react'
import { obterClaimsDoToken } from '../services/authService'
import styles from './CabecalhoStandard.module.css'

// Primeiro nome pra saudação ("Olá, Sara!") — deduzido do e-mail de login
// (parte antes do "@"), já que o token JWT hoje só carrega o username.
// Trocar por um nome completo de verdade quando o backend expuser esse
// dado num endpoint "/me" (ver contas/serializers.py UsuarioSerializer).
function primeiroNome(username) {
  if (!username) return ''
  const parteLocal = username.split('@')[0]
  const primeiraPalavra = parteLocal.split(/[._-]/)[0]
  return primeiraPalavra.charAt(0).toUpperCase() + primeiraPalavra.slice(1)
}

function formatarDataHora(data) {
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dataFormatada = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)
  return { hora, dataCapitalizada }
}

// Cabeçalho de saudação, reutilizado pelo Dashboard e pelo Perfil: nome do
// usuário, relógio, selo de estação ativa e (opcional) atalho de
// exportação.
function CabecalhoStandard({
  identificadorEstacao,
  subtitulo = 'Acompanhe em tempo real os dados da sua estação.',
  mostrarExportar = true,
}) {
  const [agora, setAgora] = useState(new Date())
  const [menuAberto, setMenuAberto] = useState(false)
  const username = obterClaimsDoToken()?.username

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(intervalo)
  }, [])

  const { hora, dataCapitalizada } = formatarDataHora(agora)

  return (
    <header className={styles.cabecalho}>
      <div className={styles.saudacao}>
        <h1 className={styles.titulo}>Olá, {primeiroNome(username)}! 👋</h1>
        <p className={styles.subtitulo}>{subtitulo}</p>
      </div>

      <div className={styles.chips}>
        <div className={styles.chip}>
          <Clock size={16} />
          <div className={styles.chipTexto}>
            <span className={styles.chipHora}>{hora}</span>
            <span className={styles.chipData}>{dataCapitalizada}</span>
          </div>
        </div>

        <div className={styles.chip}>
          <span className={styles.pontoAtivo} />
          <div className={styles.chipTexto}>
            <span className={styles.chipHora}>{identificadorEstacao}</span>
            <span className={styles.chipData}>Estação ativa</span>
          </div>
        </div>

        {mostrarExportar && (
          <div className={styles.menuExportar}>
            <button
              type="button"
              className={styles.botaoExportar}
              onClick={() => setMenuAberto((atual) => !atual)}
            >
              <Download size={16} />
              Exportar relatório
              <ChevronDown size={14} />
            </button>
            {menuAberto && (
              <div className={styles.dropdown}>
                <button type="button" className={styles.itemDropdown}>
                  Relatório completo (PDF)
                </button>
                <button type="button" className={styles.itemDropdown}>
                  Dados brutos (TXT)
                </button>
                <button type="button" className={styles.itemDropdown}>
                  Planilha (CSV)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

export default CabecalhoStandard
