// Cálculo puro da rosa dos ventos: agrupa leituras de vento (velocidade +
// direção) em 8 setores de bússola, cada um dividido em faixas de
// velocidade — é o "histograma polar" clássico de rosa dos ventos, pedido
// pra substituir o gráfico de linha do card de Vento.
export const DIRECOES = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']

// Faixas em km/h (o projeto usa km/h em todo o resto da página) — a
// referência trazida era em m/s (escala Beaufort); aqui é uma divisão
// equivalente em km/h, mais grossa (5 faixas em vez de 9) pra caber num
// card do dashboard sem virar sopa de cor.
export const FAIXAS_VENTO = [
  { chave: 'f1', min: 2, max: 10, rotulo: '2–10 km/h' },
  { chave: 'f2', min: 10, max: 20, rotulo: '10–20 km/h' },
  { chave: 'f3', min: 20, max: 30, rotulo: '20–30 km/h' },
  { chave: 'f4', min: 30, max: 45, rotulo: '30–45 km/h' },
  { chave: 'f5', min: 45, max: Infinity, rotulo: '≥45 km/h' },
]

export const LIMITE_CALMA_KMH = 2

function indiceDirecao(graus) {
  const normalizado = ((graus % 360) + 360) % 360
  return Math.round(normalizado / 45) % 8
}

function faixaDe(velocidade) {
  return FAIXAS_VENTO.find((f) => velocidade >= f.min && velocidade < f.max) ?? FAIXAS_VENTO[FAIXAS_VENTO.length - 1]
}

// `pontos`: array de { velocidade, direcaoGraus }. Devolve, por direção, a
// porcentagem do total de leituras em cada faixa (empilhável do centro pra
// fora) — mais a porcentagem geral de calmaria (sem direção definida, fica
// de fora dos 8 setores, igual convenção padrão de rosa dos ventos).
export function calcularRosaDosVentos(pontos) {
  const validos = pontos.filter((p) => p.velocidade != null && p.direcaoGraus != null)
  const total = validos.length

  const contagemPorDirecao = DIRECOES.map(() => Object.fromEntries(FAIXAS_VENTO.map((f) => [f.chave, 0])))
  let calmaContagem = 0

  validos.forEach(({ velocidade, direcaoGraus }) => {
    if (velocidade < LIMITE_CALMA_KMH) {
      calmaContagem += 1
      return
    }
    const idx = indiceDirecao(direcaoGraus)
    const faixa = faixaDe(velocidade)
    contagemPorDirecao[idx][faixa.chave] += 1
  })

  const porDirecao = DIRECOES.map((direcao, idx) => {
    const porFaixa = FAIXAS_VENTO.map((f) => ({
      ...f,
      pct: total ? (contagemPorDirecao[idx][f.chave] / total) * 100 : 0,
    }))
    return { direcao, porFaixa, totalPct: porFaixa.reduce((soma, f) => soma + f.pct, 0) }
  })

  return {
    porDirecao,
    calmaPct: total ? (calmaContagem / total) * 100 : 0,
    maiorTotalPct: Math.max(...porDirecao.map((d) => d.totalPct), 0),
    total,
  }
}

// Próximo "número redondo" acima de um valor, pra escala dos anéis de
// porcentagem (evita anel em 11,37% — usa 12%, 15%, 20% etc.).
export function proximoNumeroRedondo(valor) {
  if (valor <= 0) return 5
  const candidatos = [2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]
  return candidatos.find((c) => c >= valor) ?? Math.ceil(valor / 10) * 10
}
