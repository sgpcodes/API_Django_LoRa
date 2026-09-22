import { useTranslation } from 'react-i18next'
import { DIRECOES, FAIXAS_VENTO, calcularRosaDosVentos, proximoNumeroRedondo } from '../services/ventoRosa'
import styles from './VentoRosa.module.css'

const CENTRO = 170
const RAIO_MAX = 122
const N_ANEIS = 4

// N aponta pra cima (-90°), ângulo cresce em sentido horário — mesma
// orientação de uma bússola/mapa.
function anguloGraus(indiceDirecao) {
  return indiceDirecao * 45 - 90
}

function pontoPolar(raio, grausAngulo) {
  const rad = (grausAngulo * Math.PI) / 180
  return { x: CENTRO + raio * Math.cos(rad), y: CENTRO + raio * Math.sin(rad) }
}

// Path de um "anel de pizza" (setor anular) entre raio r0..r1 e ângulo
// a0..a1 — é o bloco que, empilhado com os outros da mesma direção do
// centro pra fora, forma a barra radial de uma rosa dos ventos.
function pathSetorAnular(r0, r1, a0, a1) {
  const p1 = pontoPolar(r1, a0)
  const p2 = pontoPolar(r1, a1)
  const p3 = pontoPolar(r0, a1)
  const p4 = pontoPolar(r0, a0)
  return `M ${p1.x} ${p1.y} A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 0 0 ${p4.x} ${p4.y} Z`
}

// Rosa dos ventos: cada um dos 8 setores de direção mostra, empilhado do
// centro pra fora, quanto tempo o vento soprou daquela direção em cada
// faixa de velocidade — substitui o gráfico de linha do card de Vento.
// `pontos`: array de { velocidade, direcaoGraus } já filtrado pro período
// escolhido (ver services/climaExternoService.js `derivarPontosVento`).
function VentoRosa({ pontos, altura = 320 }) {
  const { t } = useTranslation()
  const rosa = calcularRosaDosVentos(pontos)

  if (rosa.total === 0) {
    return <p className={styles.semDados}>{t('estacaoPagina.rosaSemDados')}</p>
  }

  const escalaMax = proximoNumeroRedondo(rosa.maiorTotalPct)
  const raioDe = (pct) => (pct / escalaMax) * RAIO_MAX
  const aneis = Array.from({ length: N_ANEIS }, (_, i) => (escalaMax / N_ANEIS) * (i + 1))
  const larguraSetor = 38 // graus desenhados de cada 45° — o resto é o respiro entre setores

  return (
    <div className={styles.container}>
      <svg viewBox="0 0 340 340" className={styles.svg} style={{ height: altura }} role="img" aria-label={t('estacaoPagina.rosaAriaLabel')}>
        {/* grade: anéis de porcentagem + raios por direção */}
        <g className={styles.grade}>
          {aneis.map((valor) => (
            <circle key={valor} cx={CENTRO} cy={CENTRO} r={raioDe(valor)} />
          ))}
          {DIRECOES.map((direcao) => {
            const ponta = pontoPolar(RAIO_MAX, anguloGraus(DIRECOES.indexOf(direcao)))
            return <line key={direcao} x1={CENTRO} y1={CENTRO} x2={ponta.x} y2={ponta.y} />
          })}
        </g>

        {/* rótulos dos anéis, ao longo do eixo NE */}
        {/* os 8 setores, cada um com as faixas empilhadas do centro pra fora */}
        {rosa.porDirecao.map(({ direcao, porFaixa }, idxDirecao) => {
          const centro = anguloGraus(idxDirecao)
          const a0 = centro - larguraSetor / 2
          const a1 = centro + larguraSetor / 2
          let raioAcumulado = 0
          return (
            <g key={direcao}>
              {porFaixa.map((faixa) => {
                if (faixa.pct <= 0) return null
                const r0 = raioDe(raioAcumulado)
                raioAcumulado += faixa.pct
                const r1 = raioDe(raioAcumulado)
                return (
                  <path key={faixa.chave} d={pathSetorAnular(r0, r1, a0, a1)} className={styles[`faixa${faixa.chave}`]}>
                    <title>
                      {direcao} · {faixa.rotulo} · {faixa.pct.toFixed(1)}%
                    </title>
                  </path>
                )
              })}
            </g>
          )
        })}

        {/* rótulos dos anéis — desenhados DEPOIS dos setores, senão uma
            fatia grande (ex.: N com 40%) cobre o número por cima. */}
        {aneis.map((valor) => {
          const p = pontoPolar(raioDe(valor), anguloGraus(0.5))
          return (
            <text key={valor} x={p.x} y={p.y} className={styles.rotuloAnel}>
              {valor.toFixed(0)}%
            </text>
          )
        })}

        {/* rótulos de direção, na borda externa */}
        {DIRECOES.map((direcao, idx) => {
          const p = pontoPolar(RAIO_MAX + 16, anguloGraus(idx))
          return (
            <text key={direcao} x={p.x} y={p.y} className={styles.rotuloDirecao}>
              {direcao}
            </text>
          )
        })}
      </svg>

      <div className={styles.legenda}>
        <span className={styles.legendaTitulo}>{t('estacaoPagina.velocidadeVento')}</span>
        <ul className={styles.listaLegenda}>
          {[...FAIXAS_VENTO].reverse().map((faixa) => (
            <li key={faixa.chave}>
              <span className={`${styles.amostraCor} ${styles[`faixa${faixa.chave}`]}`} />
              {faixa.rotulo}
            </li>
          ))}
        </ul>
        <span className={styles.calmaria}>
          {t('estacaoPagina.calmaria')}: <strong>{rosa.calmaPct.toFixed(1)}%</strong>
        </span>
      </div>
    </div>
  )
}

export default VentoRosa
