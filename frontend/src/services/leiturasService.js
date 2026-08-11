import api from './api'

// Busca todas as leituras cadastradas no backend. O filtro por período
// (hoje, últimos 7 dias, personalizado etc.) é feito no próprio frontend
// em cima desse conjunto completo — o backend não precisa saber nada
// sobre isso.
export async function buscarLeituras() {
  const resposta = await api.get('/api/leituras/')
  return resposta.data
}

// Pede para o RX consultar um rádio específico via LoRa (RSSI/SNR) no seu
// próximo check-in e enviar o resultado junto da leitura seguinte desse
// sensor. Precisa do sensor_id porque agora há vários dispositivos.
export async function solicitarAnaliseRssi(sensorId) {
  await api.post('/api/rssi/solicitar/', { sensor_id: sensorId })
}

// Diz se ainda há algum pedido de análise de RSSI pendente e, se houver,
// para qual sensor (o RX só processa um por vez).
export async function buscarStatusRssi() {
  const resposta = await api.get('/api/rssi/status/')
  return resposta.data
}

// Por sensor, a leitura mais recente que tinha um dado específico em
// dados_adicionais (ex.: "rssi_ida", "uid_remoto"). Usado para dados que não
// vêm em toda leitura, mas que devem continuar aparecendo no dashboard até
// um valor mais novo chegar, em vez de sumir no próximo check-in que não
// trouxer esse campo.
function ultimaLeituraComCampo(leituras, campo) {
  const porSensor = new Map()

  leituras.forEach((leitura) => {
    if (leitura.dados_adicionais?.[campo] == null) return

    const atual = porSensor.get(leitura.sensor_id)
    if (!atual || new Date(leitura.data_hora) > new Date(atual.data_hora)) {
      porSensor.set(leitura.sensor_id, leitura)
    }
  })

  return porSensor
}

// Uma "linha" por sensor, com a leitura mais recente dele. Cada sensor_id
// diferente vira um dispositivo na página de Dados do LoRa — então, quando
// um novo ESP32 for conectado, ele aparece aqui sozinho, sem precisar mexer
// no código.
//
// Além da leitura mais recente (para status online/offline e valores de
// temperatura/umidade), cada dispositivo carrega dois retratos "congelados"
// que só mudam quando um valor novo chega:
// - ultimaAnaliseRssi: resultado da última vez que "Analisar" foi clicado
//   (rssi_ida só vem na leitura logo após o pedido, não em toda leitura).
// - ultimaConfiguracao: último uid_remoto conhecido (config fixa do rádio,
//   lida uma vez pelo firmware e reenviada depois — mas guardamos do mesmo
//   jeito, para o caso de faltar numa leitura pontual).
export function obterUltimaLeituraPorSensor(leituras) {
  const maisRecentePorSensor = new Map()

  leituras.forEach((leitura) => {
    const atual = maisRecentePorSensor.get(leitura.sensor_id)
    if (!atual || new Date(leitura.data_hora) > new Date(atual.data_hora)) {
      maisRecentePorSensor.set(leitura.sensor_id, leitura)
    }
  })

  const ultimoRssiPorSensor = ultimaLeituraComCampo(leituras, 'rssi_ida')
  const ultimaConfigPorSensor = ultimaLeituraComCampo(leituras, 'uid_remoto')

  return Array.from(maisRecentePorSensor.values())
    .sort((a, b) => a.sensor_id.localeCompare(b.sensor_id))
    .map((leitura) => ({
      ...leitura,
      ultimaAnaliseRssi: ultimoRssiPorSensor.get(leitura.sensor_id) ?? null,
      ultimaConfiguracao: ultimaConfigPorSensor.get(leitura.sensor_id) ?? null,
    }))
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

// sensor_id distintos presentes nas leituras, em ordem alfabética — alimenta
// o seletor de dispositivo do Dashboard e a Visão Geral. Como vem dos dados
// (e não de uma lista fixa no código), um ESP32 novo aparece sozinho assim
// que a primeira leitura dele chegar, sem precisar mexer no frontend.
export function obterSensoresDisponiveis(leituras) {
  const sensores = new Set(leituras.map((leitura) => leitura.sensor_id))
  return Array.from(sensores).sort((a, b) => a.localeCompare(b))
}

// Depois de quanto tempo sem leitura um dispositivo é considerado offline —
// mesmo padrão de 5 min usado no timeout de espera do RSSI (frontend) e na
// expiração de pedido de RSSI (backend), pra não ter três critérios de
// tempo diferentes no mesmo sistema. Compartilhado entre o card de Dados
// do LoRa e a tabela da Visão Geral, pra não haver dois critérios
// diferentes de "online" no mesmo app.
const LIMIAR_ONLINE_MS = 5 * 60 * 1000

export function estaOnline(dataHoraISO) {
  return Date.now() - new Date(dataHoraISO).getTime() < LIMIAR_ONLINE_MS
}

// Paleta fixa pra identificar cada sensor visualmente (tabela e gráficos da
// Visão Geral) de forma consistente. Ciclando com "%", o 9º sensor reusa a
// cor do 1º em vez de quebrar — melhor que sensor sem cor.
export const CORES_SENSOR = [
  '#2563eb', // azul
  '#16a34a', // verde
  '#7c3aed', // roxo
  '#dc2626', // vermelho
  '#ea580c', // laranja
  '#0891b2', // ciano
  '#db2777', // rosa
  '#65a30d', // verde-oliva
]

export function corDoSensor(sensores, sensorId) {
  const indice = sensores.indexOf(sensorId)
  return CORES_SENSOR[indice % CORES_SENSOR.length] ?? CORES_SENSOR[0]
}

// Uma linha por sensor, pra tabela "Resumo por sensor" da Visão Geral:
// valores atuais (última leitura) + máxima/mínima dentro do período
// selecionado no filtro.
export function montarResumoPorSensor(leituras, leiturasDoPeriodo) {
  const maisRecentes = obterUltimaLeituraPorSensor(leituras)

  const porSensorPeriodo = new Map()
  leiturasDoPeriodo.forEach((leitura) => {
    const lista = porSensorPeriodo.get(leitura.sensor_id) ?? []
    lista.push(leitura)
    porSensorPeriodo.set(leitura.sensor_id, lista)
  })

  return maisRecentes.map((leitura) => {
    const doPeriodo = porSensorPeriodo.get(leitura.sensor_id) ?? []
    const temperaturas = doPeriodo.map((item) => item.temperatura)

    return {
      sensorId: leitura.sensor_id,
      temperaturaAtual: leitura.temperatura,
      umidadeAtual: leitura.umidade,
      temperaturaMaxima: temperaturas.length ? Math.max(...temperaturas) : null,
      temperaturaMinima: temperaturas.length ? Math.min(...temperaturas) : null,
      ultimaAtualizacao: leitura.data_hora,
      online: estaOnline(leitura.data_hora),
    }
  })
}

// Resumo agregando todos os sensores juntos (cards do topo da Visão Geral):
// médias gerais e quem bateu a máxima/mínima do período.
export function montarResumoGeral(leiturasDoPeriodo) {
  if (leiturasDoPeriodo.length === 0) return null

  const temperaturas = leiturasDoPeriodo.map((leitura) => leitura.temperatura)
  const umidades = leiturasDoPeriodo.map((leitura) => leitura.umidade)

  const leituraMaisQuente = leiturasDoPeriodo.reduce((maior, leitura) =>
    leitura.temperatura > maior.temperatura ? leitura : maior
  )
  const leituraMaisFria = leiturasDoPeriodo.reduce((menor, leitura) =>
    leitura.temperatura < menor.temperatura ? leitura : menor
  )

  return {
    temperaturaMedia: media(temperaturas),
    umidadeMedia: media(umidades),
    temperaturaMaxima: leituraMaisQuente.temperatura,
    temperaturaMaximaSensor: leituraMaisQuente.sensor_id,
    temperaturaMaximaHorario: leituraMaisQuente.data_hora,
    temperaturaMinima: leituraMaisFria.temperatura,
    temperaturaMinimaSensor: leituraMaisFria.sensor_id,
    temperaturaMinimaHorario: leituraMaisFria.data_hora,
  }
}

// Uma série por sensor, agrupada por hora — alimenta os gráficos "todos os
// sensores" da Visão Geral. Formato: [{ hora: '11h', ESP32_01: 21.4, ESP32_02: 23.1 }, ...].
// Quando um sensor não teve leitura numa hora específica, a chave dele fica
// ausente naquele ponto (o recharts simplesmente não desenha ali).
export function agruparMediaPorHoraPorSensor(leituras, sensores, campo) {
  const acumuladoPorHora = new Map()

  leituras.forEach((leitura) => {
    const hora = new Date(leitura.data_hora).getHours()
    const linha = acumuladoPorHora.get(hora) ?? {}
    const acumuladoSensor = linha[leitura.sensor_id] ?? { soma: 0, quantidade: 0 }

    acumuladoSensor.soma += leitura[campo]
    acumuladoSensor.quantidade += 1
    linha[leitura.sensor_id] = acumuladoSensor
    acumuladoPorHora.set(hora, linha)
  })

  return Array.from(acumuladoPorHora.entries())
    .sort(([horaA], [horaB]) => horaA - horaB)
    .map(([hora, linha]) => {
      const ponto = { hora: `${String(hora).padStart(2, '0')}h` }
      sensores.forEach((sensorId) => {
        const acumuladoSensor = linha[sensorId]
        if (acumuladoSensor) {
          ponto[sensorId] = Number((acumuladoSensor.soma / acumuladoSensor.quantidade).toFixed(1))
        }
      })
      return ponto
    })
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

export function paraStringData(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Ponto de partida do filtro "personalizado" (últimos 7 dias) — usado tanto
// no Dashboard quanto na Visão Geral antes do usuário escolher outras datas.
export function datasPersonalizadasIniciais() {
  const hoje = new Date()
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(hoje.getDate() - 6)
  return { inicio: paraStringData(seteDiasAtras), fim: paraStringData(hoje) }
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
