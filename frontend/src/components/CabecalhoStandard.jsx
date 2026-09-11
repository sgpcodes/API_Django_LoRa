import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function formatarDataHora(data, locale) {
  const hora = data.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const dataFormatada = data.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1)
  return { hora, dataCapitalizada }
}

// Cabeçalho de saudação, reutilizado pelo Dashboard e pelo Perfil: nome do
// usuário, relógio, selo de estação ativa e (opcional) atalho de
// exportação. `subtitulo` continua aceitando um texto pronto de quem
// chama (Perfil.jsx manda o próprio) — só cai no padrão traduzido quando
// ninguém passa nada.
function CabecalhoStandard({
  identificadorEstacao,
  estacaoOnline = true,
  subtitulo,
  mostrarExportar = true,
  mostrarChips = true,
}) {
  const { t, i18n } = useTranslation()
  const [agora, setAgora] = useState(new Date())
  const [menuAberto, setMenuAberto] = useState(false)
  const username = obterClaimsDoToken()?.username

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(intervalo)
  }, [])

  const locale = i18n.language === 'en' ? 'en-US' : 'pt-BR'
  const { hora, dataCapitalizada } = formatarDataHora(agora, locale)

  return (
    <header className={styles.cabecalho}>
      <div className={styles.saudacao}>
        <h1 className={styles.titulo}>{t('cabecalho.ola', { nome: primeiroNome(username) })}</h1>
        <p className={styles.subtitulo}>{subtitulo ?? t('cabecalho.subtituloPadrao')}</p>
      </div>

      <div className={styles.chips}>
        {mostrarChips && (
          <>
            <div className={styles.chip}>
              <Clock size={16} />
              <div className={styles.chipTexto}>
                <span className={styles.chipHora}>{hora}</span>
                <span className={styles.chipData}>{dataCapitalizada}</span>
              </div>
            </div>

            <div className={styles.chip}>
              <span className={`${styles.pontoAtivo} ${estacaoOnline ? '' : styles.pontoInativo}`} />
              <div className={styles.chipTexto}>
                <span className={styles.chipHora}>{identificadorEstacao}</span>
                <span className={styles.chipData}>
                  {estacaoOnline ? t('cabecalho.estacaoOnline') : t('cabecalho.estacaoOffline')}
                </span>
              </div>
            </div>
          </>
        )}

        {mostrarExportar && (
          <div className={styles.menuExportar}>
            <button
              type="button"
              className={styles.botaoExportar}
              onClick={() => setMenuAberto((atual) => !atual)}
            >
              <Download size={16} />
              {t('cabecalho.exportarRelatorio')}
              <ChevronDown size={14} />
            </button>
            {menuAberto && (
              <div className={styles.dropdown}>
                <button type="button" className={styles.itemDropdown}>
                  {t('cabecalho.relatorioCompleto')}
                </button>
                <button type="button" className={styles.itemDropdown}>
                  {t('cabecalho.dadosBrutos')}
                </button>
                <button type="button" className={styles.itemDropdown}>
                  {t('cabecalho.planilha')}
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
