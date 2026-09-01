// Fonte de dados de clima ENQUANTO a estação meteorológica própria (LoRa)
// não está pronta com todos os sensores. Busca de uma API externa pública,
// só pra ter dados reais de teste no Dashboard — não é a fonte definitiva.
//
// A API usada agora (Open-Meteo, gratuita, sem chave) é só um ponto de
// partida: quando a API escolhida pra valer for confirmada, só esta função
// `buscarClimaAtual` precisa mudar por dentro — o formato que ela devolve
// (ver `normalizar` no fim do arquivo) é o contrato que o Dashboard espera,
// então o resto do app não precisa saber qual provedor está por trás.
//
// O código que fala com a estação real (services/leiturasService.js) NÃO
// foi apagado, só não está sendo chamado pelo Dashboard por enquanto — ver
// pages/DashboardLora.jsx.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

// Coordenadas padrão (Maricá-RJ, sede do LACOP/UFF) — usada até a tela de
// vínculo de estação guardar uma localização própria da conta.
const COORDENADAS_PADRAO = { latitude: -22.9194, longitude: -42.8186 }

// Tabela reduzida dos WMO Weather Codes que a Open-Meteo devolve, só com
// os textos em português que aparecem no card "Condições atuais".
const DESCRICAO_POR_CODIGO = {
  0: 'Céu limpo',
  1: 'Predominantemente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina com geada',
  51: 'Garoa fraca',
  53: 'Garoa moderada',
  55: 'Garoa forte',
  61: 'Chuva fraca',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve fraca',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Pancadas de chuva fracas',
  81: 'Pancadas de chuva moderadas',
  82: 'Pancadas de chuva fortes',
  95: 'Tempestade',
  96: 'Tempestade com granizo',
  99: 'Tempestade forte com granizo',
}

const PONTOS_CARDEAIS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']

function direcaoTexto(graus) {
  if (graus == null) return '—'
  const indice = Math.round(graus / 45) % 8
  return PONTOS_CARDEAIS[indice]
}

function descricaoTempo(codigo) {
  return DESCRICAO_POR_CODIGO[codigo] ?? 'Condição indisponível'
}

function media(numeros) {
  const validos = numeros.filter((numero) => numero != null)
  if (validos.length === 0) return null
  return Number((validos.reduce((soma, numero) => soma + numero, 0) / validos.length).toFixed(1))
}

// Média circular (vetorial) de direções em graus — não dá pra tirar média
// aritmética direto de direção de vento: a média entre 350° e 10° tem que
// dar 0°/360°, não 180°. Converte cada direção num vetor unitário, tira a
// média dos vetores, e converte o ângulo resultante de volta pra graus.
function mediaCircular(graus) {
  const validos = graus.filter((valor) => valor != null)
  if (validos.length === 0) return null
  const somaSeno = validos.reduce((soma, g) => soma + Math.sin((g * Math.PI) / 180), 0)
  const somaCosseno = validos.reduce((soma, g) => soma + Math.cos((g * Math.PI) / 180), 0)
  const anguloMedio = (Math.atan2(somaSeno, somaCosseno) * 180) / Math.PI
  return Math.round((anguloMedio + 360) % 360)
}

// Agrupa as leituras horárias de um campo em pontos diários (média, mínima
// e máxima) — alimenta o gráfico histórico, a tabela diária e o resumo do
// dia, respeitando os `dias` de histórico do plano contratado (RN09/RN21:
// Standard = 30 dias).
function agruparPorDia(horas, valores, dias) {
  const porDia = new Map()

  horas.forEach((horaISO, indice) => {
    const chave = horaISO.slice(0, 10) // "AAAA-MM-DD"
    const lista = porDia.get(chave) ?? []
    lista.push(valores[indice])
    porDia.set(chave, lista)
  })

  return Array.from(porDia.entries())
    .slice(-dias)
    .map(([dataISO, lista]) => {
      const validos = lista.filter((valor) => valor != null)
      return {
        data: dataISO,
        rotulo: dataISO.slice(8, 10) + '/' + dataISO.slice(5, 7),
        media: media(lista),
        minimo: validos.length ? Number(Math.min(...validos).toFixed(1)) : null,
        maximo: validos.length ? Number(Math.max(...validos).toFixed(1)) : null,
      }
    })
}

// Igual a `agruparPorDia`, mas específico pra vento: velocidade média,
// rajada máxima do dia e direção predominante (média circular).
function agruparVentoPorDia(horas, velocidades, rajadas, direcoes, dias) {
  const porDia = new Map()

  horas.forEach((horaISO, indice) => {
    const chave = horaISO.slice(0, 10)
    const grupo = porDia.get(chave) ?? { velocidades: [], rajadas: [], direcoes: [] }
    grupo.velocidades.push(velocidades[indice])
    grupo.rajadas.push(rajadas[indice])
    grupo.direcoes.push(direcoes[indice])
    porDia.set(chave, grupo)
  })

  return Array.from(porDia.entries())
    .slice(-dias)
    .map(([dataISO, grupo]) => {
      const rajadasValidas = grupo.rajadas.filter((valor) => valor != null)
      const direcaoMedia = mediaCircular(grupo.direcoes)
      return {
        data: dataISO,
        rotulo: dataISO.slice(8, 10) + '/' + dataISO.slice(5, 7),
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
// anterior a ele — alimenta o card "Resumo do dia".
function calcularResumoDia(diarioTemperatura, diarioUmidade, diarioPressao, diarioVento) {
  function ultimoEAnterior(serie) {
    const ultimo = serie.at(-1)?.media ?? null
    const anterior = serie.at(-2)?.media ?? null
    return { ultimo, anterior }
  }

  const temperatura = ultimoEAnterior(diarioTemperatura)
  const umidade = ultimoEAnterior(diarioUmidade)
  const pressao = ultimoEAnterior(diarioPressao)
  const vento = ultimoEAnterior(diarioVento)

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

// Formato que o Dashboard consome — ver pages/Dashboard.jsx.
function normalizar(dados, diasHistorico) {
  const atual = dados.current
  const horas = dados.hourly?.time ?? []

  const diarioTemperatura = agruparPorDia(horas, dados.hourly.temperature_2m, diasHistorico)
  const diarioUmidade = agruparPorDia(horas, dados.hourly.relative_humidity_2m, diasHistorico)
  const diarioPressao = agruparPorDia(horas, dados.hourly.surface_pressure, diasHistorico)
  const diarioVento = agruparPorDia(horas, dados.hourly.wind_speed_10m, diasHistorico)
  const diarioVentoCompleto = agruparVentoPorDia(
    horas, dados.hourly.wind_speed_10m, dados.hourly.wind_gusts_10m, dados.hourly.wind_direction_10m, diasHistorico,
  )

  const historicoTemperaturaPorDia = diarioTemperatura.map((dia) => ({
    data: dia.data,
    rotulo: dia.rotulo,
    temperaturaMedia: dia.media,
  }))

  // Formato uniforme { rotulo, valor } pro carrossel de gráficos do
  // Dashboard (ver components/GraficoHistoricoCarrossel.jsx) — uma série
  // por métrica, todas com a mesma forma.
  const paraSerie = (diario) => diario.map((dia) => ({ rotulo: dia.rotulo, valor: dia.media }))
  const seriesHistoricoDiario = {
    temperatura: paraSerie(diarioTemperatura),
    umidade: paraSerie(diarioUmidade),
    pressao: paraSerie(diarioPressao),
    vento: paraSerie(diarioVento),
  }

  // Uma linha por dia (mais recente primeiro) pro carrossel de tabelas do
  // Dashboard (ver components/HistoricoDiarioTable.jsx) — mais completa
  // que a série do gráfico (mín/máx pras métricas simples; vento com
  // direção/rajada, que não fazem sentido pras outras).
  const tabelaHistoricoDiario = {
    temperatura: [...diarioTemperatura].reverse(),
    umidade: [...diarioUmidade].reverse(),
    pressao: [...diarioPressao].reverse(),
    vento: [...diarioVentoCompleto].reverse(),
  }

  const resumoDia = calcularResumoDia(diarioTemperatura, diarioUmidade, diarioPressao, diarioVento)

  return {
    temperatura: atual.temperature_2m,
    umidade: atual.relative_humidity_2m,
    pressao: atual.surface_pressure,
    vento: {
      velocidade: atual.wind_speed_10m,
      rajada: atual.wind_gusts_10m,
      direcaoGraus: atual.wind_direction_10m,
      direcaoTexto: direcaoTexto(atual.wind_direction_10m),
    },
    sensacaoTermica: atual.apparent_temperature,
    pontoDeOrvalho: atual.dew_point_2m,
    indiceUV: atual.uv_index,
    precipitacao: atual.precipitation,
    visibilidadeKm: atual.visibility != null ? Number((atual.visibility / 1000).toFixed(1)) : null,
    condicaoTexto: descricaoTempo(atual.weather_code),
    atualizadoEm: atual.time,
    historicoTemperaturaPorDia,
    seriesHistoricoDiario,
    tabelaHistoricoDiario,
    resumoDia,
  }
}

// `diasHistorico` respeita o limite do plano contratado (RN09/RN21) — 30
// dias na conta Standard.
export async function buscarClimaAtual(coordenadas = COORDENADAS_PADRAO, diasHistorico = 30) {
  const parametros = new URLSearchParams({
    latitude: coordenadas.latitude,
    longitude: coordenadas.longitude,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'dew_point_2m',
      'uv_index',
      'visibility',
    ].join(','),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    past_days: String(diasHistorico),
    forecast_days: '1',
    timezone: 'America/Sao_Paulo',
  })

  const resposta = await fetch(`${BASE_URL}?${parametros}`)
  if (!resposta.ok) {
    throw new Error('Não foi possível buscar os dados de clima.')
  }
  const dados = await resposta.json()
  return normalizar(dados, diasHistorico)
}
