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

// Novas contas/estações por mês, últimos `meses` meses (incluindo o
// atual) — contagem de verdade a partir de date_joined/criado_em. Quando
// `leiturasPorMes` é passado (vem do backend, já agregado lá — buscar
// todas as leituras teria custo alto demais só pro front agregar de
// novo), mescla um 3º valor por mês na mesma lista.
export function calcularCrescimentoMensal(contas, estacoes, leiturasPorMes) {
  const agora = new Date()
  const meses = []
  for (let i = 5; i >= 0; i -= 1) {
    const referencia = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    meses.push({ ano: referencia.getFullYear(), mes: referencia.getMonth(), rotulo: NOMES_MES[referencia.getMonth()] })
  }

  function contarNoMes(itens, campoData, ano, mes) {
    return itens.filter((item) => {
      const data = new Date(item[campoData])
      return data.getFullYear() === ano && data.getMonth() === mes
    }).length
  }

  return meses.map(({ ano, mes, rotulo }) => {
    const ponto = {
      rotulo,
      contas: contarNoMes(contas, 'date_joined', ano, mes),
      estacoes: contarNoMes(estacoes, 'criado_em', ano, mes),
    }
    if (leiturasPorMes) {
      // Backend manda `mes` 1-indexado (Django); Date.getMonth() é 0-indexado.
      const encontrado = leiturasPorMes.find((item) => item.ano === ano && item.mes - 1 === mes)
      ponto.leituras = encontrado?.total ?? 0
    }
    return ponto
  })
}
