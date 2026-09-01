import { Thermometer, Droplet, Sun, CloudRain, Eye, Cloud } from 'lucide-react'
import styles from './CondicoesAtuaisCard.module.css'

const CONDICAO_ICONE = {
  baixo: '#22c55e',
  moderado: '#f59e0b',
  alto: '#ef4444',
}

// Classifica o índice UV pra exibir o mesmo tipo de selo colorido da
// imagem de referência ("Moderado" em laranja).
function classificarUV(indice) {
  if (indice == null) return { rotulo: '—', cor: CONDICAO_ICONE.baixo }
  if (indice < 3) return { rotulo: 'Baixo', cor: CONDICAO_ICONE.baixo }
  if (indice < 6) return { rotulo: 'Moderado', cor: CONDICAO_ICONE.moderado }
  return { rotulo: 'Alto', cor: CONDICAO_ICONE.alto }
}

// Painel lateral "Condições atuais" do Dashboard — sensação térmica, ponto
// de orvalho, índice UV, precipitação nas últimas 24h e visibilidade.
function CondicoesAtuaisCard({ clima }) {
  const uv = classificarUV(clima?.indiceUV)

  return (
    <div className={styles.container}>
      <div className={styles.cabecalhoCondicao}>
        <Cloud size={40} className={styles.iconeCondicao} />
        <span className={styles.textoCondicao}>{clima?.condicaoTexto ?? '—'}</span>
      </div>

      <ul className={styles.lista}>
        <li className={styles.linha}>
          <span className={styles.rotulo}>
            <Thermometer size={14} />
            Sensação térmica
          </span>
          <span className={styles.valor}>{clima?.sensacaoTermica ?? '—'}°C</span>
        </li>
        <li className={styles.linha}>
          <span className={styles.rotulo}>
            <Droplet size={14} />
            Ponto de orvalho
          </span>
          <span className={styles.valor}>{clima?.pontoDeOrvalho ?? '—'}°C</span>
        </li>
        <li className={styles.linha}>
          <span className={styles.rotulo}>
            <Sun size={14} />
            Índice UV
          </span>
          <span className={styles.selo} style={{ backgroundColor: `${uv.cor}22`, color: uv.cor }}>
            {uv.rotulo}
          </span>
        </li>
        <li className={styles.linha}>
          <span className={styles.rotulo}>
            <CloudRain size={14} />
            Precipitação (24h)
          </span>
          <span className={styles.valor}>{clima?.precipitacao ?? 0} mm</span>
        </li>
        <li className={styles.linha}>
          <span className={styles.rotulo}>
            <Eye size={14} />
            Visibilidade
          </span>
          <span className={styles.valor}>{clima?.visibilidadeKm ?? '—'} km</span>
        </li>
      </ul>
    </div>
  )
}

export default CondicoesAtuaisCard
