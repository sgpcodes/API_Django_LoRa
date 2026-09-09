// Fonte de dados de clima a partir da ESTAÇÃO REAL (ESP32 + sensores) do
// usuário — substitui climaExternoService (API externa Open-Meteo) desde
// que a conta já tenha uma estação atribuída pelo administrador. Devolve
// o MESMO formato que climaExternoService produzia (ver `normalizar` lá),
// então `derivarVisaoPeriodo` (import direto de climaExternoService, é
// uma função pura, não muda) funciona sem nenhum ajuste.
//
// Campos que a estação real ainda não envia — vento (velocidade/direção/
// rajada só existem se um dia vierem em `dados_adicionais`), sensação
// térmica, ponto de orvalho, índice UV, visibilidade (tudo isso é
// derivado de fonte externa, não de sensor físico) — ficam `null`; os
// componentes que os exibem já mostram "—" nesse caso.
import api from './api'

const DIAS_HISTORICO_MAXIMO = 30
const PONTOS_CARDEAIS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']

export function direcaoTexto(graus) {
  if (graus == null) return '—'
  const indice = Math.round(graus / 45) % 8
  return PONTOS_CARDEAIS[indice]
}

function media(numeros) {
  const validos = numeros.filter((numero) => numero != null)
  if (validos.length === 0) return null
  return Number((validos.reduce((soma, numero) => soma + numero, 0) / validos.length).toFixed(1))
}

// Média circular (vetorial) — ver climaExternoService.js para a explicação
// completa de por que direção de vento não pode usar média aritmética.
function mediaCircular(graus) {
  const validos = graus.filter((valor) => valor != null)
  if (validos.length === 0) return null
  const somaSeno = validos.reduce((soma, g) => soma + Math.sin((g * Math.PI) / 180), 0)
  const somaCosseno = validos.reduce((soma, g) => soma + Math.cos((g * Math.PI) / 180), 0)
  const anguloMedio = (Math.atan2(somaSeno, somaCosseno) * 180) / Math.PI
  return Math.round((anguloMedio + 360) % 360)
}

// O backend devolve `data_hora` em UTC (TIME_ZONE='UTC' no settings). Os
// pontos horários/diários precisam ficar no formato "hora local sem Z" —
// mesma convenção que climaExternoService usa (a Open-Meteo já devolve
// horário local, por causa do parâmetro `timezone`) — porque
// `derivarVisaoPeriodo` faz `dataHora.startsWith("AAAA-MM-DD")` pra
// filtrar hoje/ontem, comparando com uma data também calculada em hora
// local. Convertendo aqui, os dois lados usam a mesma convenção.
function paraLocalISO(dataHoraUTC) {
  const d = new Date(dataHoraUTC)
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const minuto = String(d.getMinutes()).padStart(2, '0')
  const segundo = String(d.getSeconds()).padStart(2, '0')
  return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`
}

function horaRotulo(dataHoraLocalISO) {
  return dataHoraLocalISO.slice(11, 13) + 'h'
}

function diaRotulo(dataISO) {
  return dataISO.slice(8, 10) + '/' + dataISO.slice(5, 7)
}

function chaveHora(dataHoraLocalISO) {
  return dataHoraLocalISO.slice(0, 13)
}

function chaveDia(dataHoraLocalISO) {
  return dataHoraLocalISO.slice(0, 10)
}

// Agrupa leituras (que chegam a cada poucos minutos) numa série horária —
// um ponto por hora, com a média do campo dentro daquela hora.
function agruparPorHora(pontos, extrator) {
  const porHora = new Map()
  pontos.forEach((ponto) => {
    const chave = chaveHora(ponto.dataHoraLocal)
    const grupo = porHora.get(chave) ?? { dataHora: ponto.dataHoraLocal, valores: [] }
    grupo.valores.push(extrator(ponto))
    porHora.set(chave, grupo)
  })
  return Array.from(porHora.values())
    .sort((a, b) => (a.dataHora < b.dataHora ? -1 : 1))
    .map((grupo) => ({ dataHora: grupo.dataHora, rotulo: horaRotulo(grupo.dataHora), valor: media(grupo.valores) }))
}

function agruparVentoPorHora(pontos) {
  const porHora = new Map()
  pontos.forEach((ponto) => {
    const chave = chaveHora(ponto.dataHoraLocal)
    const grupo = porHora.get(chave) ?? { dataHora: ponto.dataHoraLocal, velocidades: [], rajadas: [], direcoes: [] }
    grupo.velocidades.push(ponto.leitura.dados_adicionais?.velocidade_vento ?? null)
    grupo.rajadas.push(ponto.leitura.dados_adicionais?.rajada_vento ?? null)
    grupo.direcoes.push(ponto.leitura.dados_adicionais?.direcao_vento ?? null)
    porHora.set(chave, grupo)
  })
  return Array.from(porHora.values())
    .sort((a, b) => (a.dataHora < b.dataHora ? -1 : 1))
    .map((grupo) => {
      const rajadasValidas = grupo.rajadas.filter((v) => v != null)
      const direcaoGraus = mediaCircular(grupo.direcoes)
      return {
        dataHora: grupo.dataHora,
        rotulo: horaRotulo(grupo.dataHora),
        velocidade: media(grupo.velocidades),
        rajada: rajadasValidas.length ? Number(Math.max(...rajadasValidas).toFixed(1)) : null,
        direcaoGraus,
        direcaoTexto: direcaoTexto(direcaoGraus),
      }
    })
}

function agruparPorDia(pontos, extrator) {
  const porDia = new Map()
  pontos.forEach((ponto) => {
    const chave = chaveDia(ponto.dataHoraLocal)
    const lista = porDia.get(chave) ?? []
    lista.push(extrator(ponto))
    porDia.set(chave, lista)
  })
  return Array.from(porDia.entries())
    .sort(([dataA], [dataB]) => (dataA < dataB ? -1 : 1))
    .map(([dataISO, lista]) => {
      const validos = lista.filter((valor) => valor != null)
      return {
        data: dataISO,
        rotulo: diaRotulo(dataISO),
        media: media(lista),
        minimo: validos.length ? Number(Math.min(...validos).toFixed(1)) : null,
        maximo: validos.length ? Number(Math.max(...validos).toFixed(1)) : null,
      }
    })
}

function agruparVentoPorDia(pontos) {
  const porDia = new Map()
  pontos.forEach((ponto) => {
    const chave = chaveDia(ponto.dataHoraLocal)
    const grupo = porDia.get(chave) ?? { velocidades: [], rajadas: [], direcoes: [] }
    grupo.velocidades.push(ponto.leitura.dados_adicionais?.velocidade_vento ?? null)
    grupo.rajadas.push(ponto.leitura.dados_adicionais?.rajada_vento ?? null)
    grupo.direcoes.push(ponto.leitura.dados_adicionais?.direcao_vento ?? null)
    porDia.set(chave, grupo)
  })
  return Array.from(porDia.entries())
    .sort(([dataA], [dataB]) => (dataA < dataB ? -1 : 1))
    .map(([dataISO, grupo]) => {
      const rajadasValidas = grupo.rajadas.filter((v) => v != null)
      const direcaoMedia = mediaCircular(grupo.direcoes)
      return {
        data: dataISO,
        rotulo: diaRotulo(dataISO),
        velocidadeMedia: media(grupo.velocidades),
        rajadaMaxima: rajadasValidas.length ? Number(Math.max(...rajadasValidas).toFixed(1)) : null,
        direcaoGraus: direcaoMedia,
        direcaoTexto: direcaoTexto(direcaoMedia),
      }
    })
}

function delta(hoje, ontem) {
  if (hoje == null || ontem == null) return null
  return Number((hoje - ontem).toFixed(1))
}

// Compara a média do último dia completo de histórico com a do dia
// anterior — mesma lógica de climaExternoService.calcularResumoDia.
function calcularResumoDia(diariaTemperatura, diariaUmidade, diariaPressao, diariaVento) {
  function ultimoEAnterior(serie) {
    return { ultimo: serie.at(-1)?.media ?? null, anterior: serie.at(-2)?.media ?? null }
  }
  const temperatura = ultimoEAnterior(diariaTemperatura)
  const umidade = ultimoEAnterior(diariaUmidade)
  const pressao = ultimoEAnterior(diariaPressao)
  const vento = { ultimo: diariaVento.at(-1)?.velocidadeMedia ?? null, anterior: diariaVento.at(-2)?.velocidadeMedia ?? null }

  return {
    temperaturaMedia: temperatura.ultimo,
    deltaTemperatura: delta(temperatura.ultimo, temperatura.anterior),
    umidadeMedia: umidade.ultimo,
    deltaUmidade: delta(umidade.ultimo, umidade.anterior),
    pressaoMedia: pressao.ultimo,
    deltaPressao: delta(pressao.ultimo, pressao.anterior),
    ventoMedio: vento.ultimo,
    deltaVento: delta(vento.ultimo, vento.anterior),
  }
}

// Só os últimos DIAS_HISTORICO_MAXIMO dias — mesmo teto que a fonte
// externa usava (RN09/RN21), agora aplicado sobre as leituras reais.
function apenasRecentes(leituras) {
  const limite = new Date()
  limite.setDate(limite.getDate() - DIAS_HISTORICO_MAXIMO)
  return leituras.filter((leitura) => new Date(leitura.data_hora) >= limite)
}

// Busca as leituras da estação (sensor_id = identificador da Estacao) e
// devolve no mesmo formato que o Dashboard já sabe consumir. `null` quando
// a estação existe mas ainda não mandou nenhuma leitura (recém-atribuída).
export async function buscarClimaDaEstacao(identificadorEstacao) {
  const resposta = await api.get('/api/leituras/', { params: { sensor_id: identificadorEstacao } })
  const leituras = apenasRecentes(resposta.data).sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))

  if (leituras.length === 0) return null

  const pontos = leituras.map((leitura) => ({ leitura, dataHoraLocal: paraLocalISO(leitura.data_hora) }))
  const ultimoPonto = pontos.at(-1)

  const horariaTemperatura = agruparPorHora(pontos, (p) => p.leitura.temperatura)
  const horariaUmidade = agruparPorHora(pontos, (p) => p.leitura.umidade)
  const horariaPressao = agruparPorHora(pontos, (p) => p.leitura.pressao)
  const horariaVento = agruparVentoPorHora(pontos)

  const diariaTemperatura = agruparPorDia(pontos, (p) => p.leitura.temperatura)
  const diariaUmidade = agruparPorDia(pontos, (p) => p.leitura.umidade)
  const diariaPressao = agruparPorDia(pontos, (p) => p.leitura.pressao)
  const diariaVento = agruparVentoPorDia(pontos)

  const resumoDia = calcularResumoDia(diariaTemperatura, diariaUmidade, diariaPressao, diariaVento)
  const ventoAtual = ultimoPonto.leitura.dados_adicionais ?? {}

  return {
    temperatura: ultimoPonto.leitura.temperatura,
    umidade: ultimoPonto.leitura.umidade,
    pressao: ultimoPonto.leitura.pressao,
    vento: {
      velocidade: ventoAtual.velocidade_vento ?? null,
      rajada: ventoAtual.rajada_vento ?? null,
      direcaoGraus: ventoAtual.direcao_vento ?? null,
      direcaoTexto: direcaoTexto(ventoAtual.direcao_vento ?? null),
    },
    sensacaoTermica: null,
    pontoDeOrvalho: null,
    indiceUV: null,
    precipitacao: null,
    visibilidadeKm: null,
    condicaoTexto: 'Dados da estação',
    atualizadoEm: ultimoPonto.leitura.data_hora,
    resumoDia,
    horaria: { temperatura: horariaTemperatura, umidade: horariaUmidade, pressao: horariaPressao, vento: horariaVento },
    diaria: { temperatura: diariaTemperatura, umidade: diariaUmidade, pressao: diariaPressao, vento: diariaVento },
  }
}
