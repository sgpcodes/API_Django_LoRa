import api from './api'

// Busca todas as leituras cadastradas no backend. O filtro por período
// (hoje, últimos 7 dias, personalizado etc.) é feito no próprio frontend
// em cima desse conjunto completo — o backend não precisa saber nada
// sobre isso.
export async function buscarLeituras() {
  const resposta = await api.get('/api/leituras/')
  return resposta.data
}

function media(numeros) {
  const soma = numeros.reduce((total, valor) => total + valor, 0)
  return Number((soma / numeros.length).toFixed(1))
}

// O ESP32 envia uma leitura por minuto, mas o gráfico deve mostrar apenas
// a média de temperatura de cada hora (00h, 01h, 02h...), então agrupamos
// as leituras por hora e calculamos a média de cada grupo.
export function agruparMediaPorHora(leituras) {
  const acumuladoPorHora = new Map()

  leituras.forEach((leitura) => {
    const hora = new Date(leitura.data_hora).getHours()
    const acumulado = acumuladoPorHora.get(hora) || { soma: 0, quantidade: 0 }

    acumulado.soma += leitura.temperatura
    acumulado.quantidade += 1
    acumuladoPorHora.set(hora, acumulado)
  })

  return Array.from(acumuladoPorHora.entries())
    .sort(([horaA], [horaB]) => horaA - horaB)
    .map(([hora, { soma, quantidade }]) => ({
      hora: `${String(hora).padStart(2, '0')}h`,
      temperaturaMedia: Number((soma / quantidade).toFixed(1)),
    }))
}

// A leitura mais recente é usada para os dados em destaque no topo do
// dashboard (temperatura atual, umidade, sensor e horário).
export function obterLeituraMaisRecente(leituras) {
  if (leituras.length === 0) return null

  return leituras.reduce((maisRecente, leitura) =>
    new Date(leitura.data_hora) > new Date(maisRecente.data_hora)
      ? leitura
      : maisRecente
  )
}

// Transforma a opção escolhida no filtro de período ("hoje", "7dias"...)
// no intervalo de datas correspondente. Para "personalizado", as datas
// já escolhidas pelo usuário (strings "AAAA-MM-DD") são usadas direto.
export function obterIntervaloPeriodo(periodo, personalizado) {
  const agora = new Date()
  const inicioDeHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const fimDeHoje = new Date(inicioDeHoje)
  fimDeHoje.setHours(23, 59, 59, 999)

  switch (periodo) {
    case 'ontem': {
      const inicio = new Date(inicioDeHoje)
      inicio.setDate(inicio.getDate() - 1)
      const fim = new Date(inicio)
      fim.setHours(23, 59, 59, 999)
      return { inicio, fim }
    }
    case '7dias': {
      const inicio = new Date(inicioDeHoje)
      inicio.setDate(inicio.getDate() - 6)
      return { inicio, fim: fimDeHoje }
    }
    case '30dias': {
      const inicio = new Date(inicioDeHoje)
      inicio.setDate(inicio.getDate() - 29)
      return { inicio, fim: fimDeHoje }
    }
    case 'personalizado':
      return {
        inicio: new Date(`${personalizado.inicio}T00:00:00`),
        fim: new Date(`${personalizado.fim}T23:59:59`),
      }
    case 'hoje':
    default:
      return { inicio: inicioDeHoje, fim: fimDeHoje }
  }
}

// Período imediatamente anterior, com a mesma duração do período
// selecionado — usado só para comparar ("2.4°C acima da média").
export function obterIntervaloAnterior({ inicio, fim }) {
  const duracaoMs = fim.getTime() - inicio.getTime()
  const fimAnterior = new Date(inicio.getTime() - 1000)
  const inicioAnterior = new Date(fimAnterior.getTime() - duracaoMs)
  return { inicio: inicioAnterior, fim: fimAnterior }
}

export function filtrarPorPeriodo(leituras, { inicio, fim }) {
  return leituras.filter((leitura) => {
    const dataHora = new Date(leitura.data_hora)
    return dataHora >= inicio && dataHora <= fim
  })
}

// Agrupa as leituras por dia (não por hora), para a tabela de histórico
// e os gráficos de evolução — cada dia vira um ponto/linha da tabela.
export function agruparPorDia(leituras) {
  const acumuladoPorDia = new Map()

  leituras.forEach((leitura) => {
    const dataHora = new Date(leitura.data_hora)
    const chave = dataHora.toDateString()
    const grupo = acumuladoPorDia.get(chave) || {
      data: new Date(dataHora.getFullYear(), dataHora.getMonth(), dataHora.getDate()),
      temperaturas: [],
      umidades: [],
    }

    grupo.temperaturas.push(leitura.temperatura)
    grupo.umidades.push(leitura.umidade)
    acumuladoPorDia.set(chave, grupo)
  })

  return Array.from(acumuladoPorDia.values())
    .sort((a, b) => a.data - b.data)
    .map((grupo) => ({
      data: grupo.data,
      temperaturaMedia: media(grupo.temperaturas),
      temperaturaMaxima: Math.max(...grupo.temperaturas),
      temperaturaMinima: Math.min(...grupo.temperaturas),
      umidadeMedia: media(grupo.umidades),
    }))
}

// Resumo estatístico do período selecionado, comparado com o período
// anterior de mesma duração (para o "acima/abaixo da média").
export function calcularResumo(leiturasDoPeriodo, leiturasDoPeriodoAnterior) {
  if (leiturasDoPeriodo.length === 0) return null

  const temperaturas = leiturasDoPeriodo.map((leitura) => leitura.temperatura)
  const umidades = leiturasDoPeriodo.map((leitura) => leitura.umidade)

  const leituraMaisQuente = leiturasDoPeriodo.reduce((maior, leitura) =>
    leitura.temperatura > maior.temperatura ? leitura : maior
  )
  const leituraMaisFria = leiturasDoPeriodo.reduce((menor, leitura) =>
    leitura.temperatura < menor.temperatura ? leitura : menor
  )

  const temperaturaMedia = media(temperaturas)
  const umidadeMedia = media(umidades)

  const anterior =
    leiturasDoPeriodoAnterior.length > 0
      ? {
          temperaturaMedia: media(leiturasDoPeriodoAnterior.map((leitura) => leitura.temperatura)),
          umidadeMedia: media(leiturasDoPeriodoAnterior.map((leitura) => leitura.umidade)),
        }
      : null

  return {
    temperaturaMedia,
    temperaturaMaxima: leituraMaisQuente.temperatura,
    temperaturaMaximaHorario: leituraMaisQuente.data_hora,
    temperaturaMinima: leituraMaisFria.temperatura,
    temperaturaMinimaHorario: leituraMaisFria.data_hora,
    umidadeMedia,
    deltaTemperaturaMedia: anterior
      ? Number((temperaturaMedia - anterior.temperaturaMedia).toFixed(1))
      : null,
    deltaUmidadeMedia: anterior
      ? Number((umidadeMedia - anterior.umidadeMedia).toFixed(1))
      : null,
  }
}
