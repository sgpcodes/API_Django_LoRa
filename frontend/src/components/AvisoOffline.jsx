import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { buscarEstadoSincronizacao } from '../services/sincronizacaoService'
import styles from './AvisoOffline.module.css'

const INTERVALO_CONSULTA_MS = 30_000

// Só aparece em instalações Raspberry Pi com backup local configurado
// (CLOUD_DATABASE_URL) — em qualquer outra instalação (Render), o
// backend responde `sincronizacao_configurada: false` e este componente
// não renderiza nada. Fica no layout que envolve tanto o menu comum
// quanto o Painel Administrativo (ver PortaDeEntradaApp.jsx), pra
// aparecer em qualquer página logada.
function AvisoOffline() {
  const { t } = useTranslation()
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    let cancelado = false

    async function consultar() {
      try {
        const dados = await buscarEstadoSincronizacao()
        if (!cancelado) setEstado(dados)
      } catch {
        // Falha ao consultar o próprio status não deve gerar um segundo
        // aviso de erro em cima do aviso de offline — ignora e tenta de
        // novo no próximo ciclo.
      }
    }

    consultar()
    const intervalo = setInterval(consultar, INTERVALO_CONSULTA_MS)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [])

  if (!estado?.sincronizacao_configurada || estado.nuvem_alcancavel) {
    return null
  }

  return (
    <div className={styles.aviso} role="status">
      <WifiOff size={16} />
      <span className={styles.titulo}>{t('avisoOffline.titulo')}</span>
      <span className={styles.descricao}>
        {t('avisoOffline.descricao', { count: estado.leituras_pendentes })}
      </span>
    </div>
  )
}

export default AvisoOffline
