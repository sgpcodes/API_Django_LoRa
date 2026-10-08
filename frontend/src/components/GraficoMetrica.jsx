import { useTranslation } from 'react-i18next'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import styles from './GraficoMetrica.module.css'

// Pressão sempre no mesmo intervalo (980–1.040 hPa, pedido explícito) em
// vez de escala automática — assim uma leitura de 1013 hPa não estica o
// eixo inteiro do jeito que a variação natural do dia (poucos hPa) faria
// com auto-scale, e dá pra comparar visualmente dias diferentes na mesma
// régua. A linha pontilhada marca a pressão atmosférica padrão ao nível
// do mar (1.013,25 hPa) como referência — a legenda dela fica numa
// legendinha ABAIXO do gráfico (não mais como rótulo em cima da linha:
// colidia com os pontos de dado, "texto no meio do gráfico").
const PRESSAO_MINIMA = 980
const PRESSAO_MAXIMA = 1040
const PRESSAO_PADRAO_NIVEL_DO_MAR = 1013.25

// Escala do eixo Y da temperatura se adapta aos dados visíveis (pedido
// explícito: NÃO fixar 18–22°C no código, senão um dia de 32°C fica todo
// cortado) — arredonda o mínimo pra baixo e o máximo pra cima, com pelo
// menos 1°C de folga de cada lado. Quando o dado já bate exatamente num
// número inteiro (ex.: mínima do dia = 30,0°C), só arredondar não dá
// folga nenhuma (30 vira 30), por isso soma mais 1°C nesse caso.
function calcularDominioTemperatura(dados) {
  const valores = dados.map((p) => p.valor).filter((v) => v != null)
  if (valores.length === 0) return undefined

  const minDado = Math.min(...valores)
  const maxDado = Math.max(...valores)

  const minBase = Math.floor(minDado)
  const minEscala = minBase === minDado ? minBase - 1 : minBase

  const maxBase = Math.ceil(maxDado)
  const maxEscala = maxBase === maxDado ? maxBase + 1 : maxBase

  return [minEscala, maxEscala]
}

// Um gráfico de uma métrica só (área ou barra, ver `metrica.tipo` em
// services/metricasClima.js) — reaproveitado pelo carrossel do Dashboard,
// pelo modal "ver todas as métricas" e pela grade de 5 gráficos da página
// da estação (ver GradeGraficosMetricas.jsx). Chuva usa barra (RF-19: o
// dado é discreto por hora, não faz sentido interpolar como área).
//
// Cada métrica tem sua própria cor (--metrica-<chave> no theme.css, pedido
// explícito — "gráficos coloridos, cores diferentes") em vez de todas
// usarem o mesmo --chart-line azul.
// Cores das linhas de máxima/mínima — fixas (não usam a cor da própria
// métrica, pra nunca se confundir com a linha de valor/média): laranja
// quente pra máxima, azul frio pra mínima, reaproveitando tokens que já
// existem no tema (vento/chuva) em vez de inventar cor nova — ganham o
// ajuste de claro/escuro desses tokens de graça.
const COR_MAXIMA = 'var(--metrica-vento)'
const COR_MINIMA = 'var(--metrica-chuva)'
const COR_MEDIA = 'var(--metrica-umidade)'

function GraficoMetrica({ metrica, dados, altura = 280, maxMin }) {
  const { t } = useTranslation()
  // Linhas de máxima/mínima — só pedidas pra temperatura e umidade (não
  // pros outros gráficos), sólidas e coloridas, mesmo peso visual da
  // linha de valor (3 outras "séries" lado a lado no mesmo gráfico, não
  // uma marcação discreta). Em "7 dias"/"30 dias" cada ponto já é um
  // dia, então máxima/mínima variam ponto a ponto (Line de verdade, com
  // os dados que `derivarVisaoPeriodo` já anexa em cada ponto). Em
  // "Hoje"/"Ontem" (dado por hora) não existe "máxima da hora" — ali é
  // uma única referência constante pro dia inteiro (`maxMin`, vindo de
  // `resumoTopo.maxMin`), desenhada como ReferenceLine (mesma cor/peso).
  const mostraMaxMin = metrica.chave === 'temperatura' || metrica.chave === 'umidade'
  const maxMinPorPonto = mostraMaxMin && dados.some((p) => p.maximo != null)
  // Quando o gráfico tem as 3 linhas (média/máxima/mínima), a média
  // sempre fica verde — pedido explícito, pra ser consistente nos dois
  // gráficos (temperatura e umidade) em vez de cada um usar a cor
  // "própria" da métrica (--metrica-temperatura vermelho só pra
  // temperatura, por exemplo). Nos outros gráficos (sem máxima/mínima),
  // continua usando a cor própria da métrica, como sempre.
  const cor = mostraMaxMin ? COR_MEDIA : `var(--metrica-${metrica.chave})`
  const ehPressao = metrica.chave === 'pressao'
  const ehTemperatura = metrica.chave === 'temperatura'

  if (metrica.tipo === 'barra') {
    return (
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis
            unit={metrica.unidade}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Bar dataKey="valor" fill={cor} radius={[3, 3, 0, 0]} animationDuration={500} isAnimationActive />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  let dominioY
  if (ehPressao) dominioY = [PRESSAO_MINIMA, PRESSAO_MAXIMA]
  else if (ehTemperatura) dominioY = calcularDominioTemperatura(dados)

  return (
    <div>
      <ResponsiveContainer width="100%" height={altura}>
        <AreaChart data={dados} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`corArea-${metrica.chave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis
            unit={metrica.unidade}
            domain={dominioY}
            tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            formatter={(valor) => [`${valor}${metrica.unidade}`, metrica.titulo]}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={3}
            fill={`url(#corArea-${metrica.chave})`}
            dot={{ r: 4, strokeWidth: 0, fill: cor }}
            activeDot={{ r: 6 }}
            animationDuration={500}
            isAnimationActive
          />
          {ehPressao && <ReferenceLine y={PRESSAO_PADRAO_NIVEL_DO_MAR} stroke="var(--color-text)" strokeWidth={2} strokeDasharray="6 3" />}

          {maxMinPorPonto && (
            <>
              <Line
                type="monotone"
                dataKey="maximo"
                stroke={COR_MAXIMA}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: COR_MAXIMA }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="minimo"
                stroke={COR_MINIMA}
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0, fill: COR_MINIMA }}
                isAnimationActive={false}
              />
            </>
          )}
          {!maxMinPorPonto && mostraMaxMin && maxMin?.maximo != null && (
            <ReferenceLine y={maxMin.maximo} stroke={COR_MAXIMA} strokeWidth={3} />
          )}
          {!maxMinPorPonto && mostraMaxMin && maxMin?.minimo != null && (
            <ReferenceLine y={maxMin.minimo} stroke={COR_MINIMA} strokeWidth={3} />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {ehPressao && (
        <p className={styles.legendaLinha}>
          <span className={styles.amostraLinha} /> {t('estacaoPagina.pressaoPadraoLegenda', { valor: '1.013,25' })}
        </p>
      )}
      {mostraMaxMin && (maxMinPorPonto || (maxMin?.maximo != null && maxMin?.minimo != null)) && (
        <p className={styles.legendaLinha}>
          <span className={`${styles.amostraLinha} ${styles.amostraLinhaSolida}`} style={{ borderTopColor: COR_MAXIMA }} />{' '}
          {t('estacaoPagina.maximaLegenda')}
          <span
            className={`${styles.amostraLinha} ${styles.amostraLinhaSolida} ${styles.amostraLinhaClara}`}
            style={{ borderTopColor: COR_MINIMA }}
          />{' '}
          {t('estacaoPagina.minimaLegenda')}
        </p>
      )}
    </div>
  )
}

export default GraficoMetrica
