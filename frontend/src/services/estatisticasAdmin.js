// Cálculos compartilhados entre o Dashboard e a Manutenção do Painel
// Administrativo — os dois mostram tendência (contas/estações cadastradas
// vs. período anterior) e crescimento mensal, sempre a partir de dado que
// já veio do backend (date_joined/criado_em, ou leituras_por_mes no caso
// de leituras). Nada aqui estima ou simula: sem base anterior pra
// comparar, a função devolve null e a tela mostra só o total, sem seta.

export const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// % de crescimento no período: quantos itens novos entraram nos últimos
// `dias` contra quantos já existiam antes disso.
export function calcularTendencia(itens, campoData, dias) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000
  const novos = itens.filter((item) => new Date(item[campoData]).getTime() >= limite).length
  const baseAnterior = itens.length - novos
  if (baseAnterior <= 0) return null
  return Math.round((novos / baseAnterior) * 100)
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

// Chave e rótulo de um "bucket" (ponto do gráfico) conforme a
// granularidade escolhida pra o período — hora pra hoje/ontem, dia pra
// janelas curtas, semana pra 3 meses, mês pra 1 ano/personalizado longo.
function chaveBucket(data, granularidade) {
  // Sempre a partir do INÍCIO do bucket (ex.: segunda-feira daquela
  // semana), não da data bruta — uma leitura de quarta-feira tem que
  // cair na mesma chave da segunda-feira da semana dela, senão nunca
  // bate com nenhum bucket gerado por gerarBuckets() (bug real: uma
  // versão anterior usava a data bruta aqui pra granularidade "semana",
  // e nenhum item batia com bucket nenhum).
  const inicio = inicioBucket(data, granularidade)
  if (granularidade === 'mes') return `${inicio.getFullYear()}-${inicio.getMonth()}`
  if (granularidade === 'hora') return `${inicio.getFullYear()}-${inicio.getMonth()}-${inicio.getDate()}-${inicio.getHours()}`
  return `${inicio.getFullYear()}-${inicio.getMonth()}-${inicio.getDate()}`
}

function rotuloBucket(data, granularidade) {
  if (granularidade === 'mes') return NOMES_MES[data.getMonth()]
  if (granularidade === 'hora') return `${String(data.getHours()).padStart(2, '0')}h`
  return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`
}

function inicioBucket(data, granularidade) {
  const d = new Date(data)
  if (granularidade === 'mes') return new Date(d.getFullYear(), d.getMonth(), 1)
  if (granularidade === 'hora') {
    d.setMinutes(0, 0, 0)
    return d
  }
  d.setHours(0, 0, 0, 0)
  if (granularidade === 'semana') {
    const diaSemana = (d.getDay() + 6) % 7 // 0 = segunda
    d.setDate(d.getDate() - diaSemana)
  }
  return d
}

function proximoBucket(data, granularidade) {
  const d = new Date(data)
  if (granularidade === 'mes') {
    d.setMonth(d.getMonth() + 1)
  } else if (granularidade === 'hora') {
    d.setHours(d.getHours() + 1)
  } else if (granularidade === 'semana') {
    d.setDate(d.getDate() + 7)
  } else {
    d.setDate(d.getDate() + 1)
  }
  return d
}

// Início/fim/granularidade de cada opção do seletor de período do
// gráfico "Crescimento da plataforma" — mesmos nomes de período usados
// no seletor do Dashboard (Dashboard.jsx), pra manter a mesma linguagem
// em telas diferentes. "Personalizado" escolhe a granularidade sozinho
// conforme o tamanho do intervalo, pra nunca desenhar um gráfico com
// centenas de pontos sem rótulo legível.
function limitesDoPeriodo(periodo, rangePersonalizado) {
  const agora = new Date()
  if (periodo === 'hoje') {
    return { inicio: inicioBucket(agora, 'dia'), fim: agora, granularidade: 'hora' }
  }
  if (periodo === 'ontem') {
    const ontem = new Date(agora.getTime() - UM_DIA_MS)
    const inicio = inicioBucket(ontem, 'dia')
    return { inicio, fim: new Date(inicio.getTime() + UM_DIA_MS - 1), granularidade: 'hora' }
  }
  if (periodo === '7dias') {
    return { inicio: inicioBucket(new Date(agora.getTime() - 6 * UM_DIA_MS), 'dia'), fim: agora, granularidade: 'dia' }
  }
  if (periodo === '3meses') {
    return { inicio: inicioBucket(new Date(agora.getTime() - 89 * UM_DIA_MS), 'dia'), fim: agora, granularidade: 'semana' }
  }
  if (periodo === '1ano') {
    return { inicio: new Date(agora.getFullYear(), agora.getMonth() - 11, 1), fim: agora, granularidade: 'mes' }
  }
  if (periodo === 'personalizado' && rangePersonalizado) {
    const inicio = new Date(`${rangePersonalizado.inicio}T00:00:00`)
    const fim = new Date(`${rangePersonalizado.fim}T23:59:59`)
    const dias = (fim - inicio) / UM_DIA_MS
    const granularidade = dias <= 2 ? 'hora' : dias <= 45 ? 'dia' : dias <= 180 ? 'semana' : 'mes'
    return { inicio, fim, granularidade }
  }
  // '30dias' e padrão
  return { inicio: inicioBucket(new Date(agora.getTime() - 29 * UM_DIA_MS), 'dia'), fim: agora, granularidade: 'dia' }
}

// Novas contas/estações por período, uma linha por bucket (hora/dia/
// semana/mês conforme o período escolhido) — contagem de verdade a
// partir de date_joined/criado_em, sem precisar o backend agregar nada
// (as duas listas já vêm completas pro resto da tela).
export function calcularCrescimentoPeriodo(contas, estacoes, periodo, rangePersonalizado) {
  const { inicio, fim, granularidade } = limitesDoPeriodo(periodo, rangePersonalizado)

  const buckets = []
  let cursor = inicioBucket(inicio, granularidade)
  const fimBucket = inicioBucket(fim, granularidade)
  while (cursor <= fimBucket) {
    buckets.push({ chave: chaveBucket(cursor, granularidade), rotulo: rotuloBucket(cursor, granularidade) })
    cursor = proximoBucket(cursor, granularidade)
  }

  function contarPorBucket(itens, campoData) {
    const contagem = new Map()
    itens.forEach((item) => {
      const data = new Date(item[campoData])
      if (data < inicio || data > fim) return
      const chave = chaveBucket(data, granularidade)
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    })
    return contagem
  }

  const contasPorBucket = contarPorBucket(contas, 'date_joined')
  const estacoesPorBucket = contarPorBucket(estacoes, 'criado_em')

  return buckets.map((bucket) => ({
    rotulo: bucket.rotulo,
    contas: contasPorBucket.get(bucket.chave) ?? 0,
    estacoes: estacoesPorBucket.get(bucket.chave) ?? 0,
  }))
}
