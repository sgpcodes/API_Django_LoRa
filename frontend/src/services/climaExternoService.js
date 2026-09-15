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
// Busca sempre os últimos 30 dias de uma vez (limite do plano Standard,
// RN09/RN21) — trocar entre Hoje/Ontem/7 dias/30 dias no Dashboard não
// busca de novo na API, só filtra/agrupa o que já foi buscado (ver
// `derivarVisaoPeriodo`), então trocar de período é instantâneo.
//
// O código que fala com a estação real (services/leiturasService.js) NÃO
// foi apagado, só não está sendo chamado pelo Dashboard por enquanto — ver
// pages/DashboardLora.jsx.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'
const DIAS_HISTORICO_MAXIMO = 30 // RN09/RN21 — teto do plano Standard

// Coordenadas padrão (Maricá-RJ, sede do LACOP/UFF) — usada até a tela de
// vínculo de estação guardar uma localização própria da conta. Exportada
// porque o cabeçalho da página da estação (EstacaoCabecalho.jsx) usa o
// mesmo ponto pra centralizar o mapa.
export const COORDENADAS_PADRAO = { latitude: -22.9194, longitude: -42.8186 }

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

function horaRotulo(dataHoraISO) {
  return dataHoraISO.slice(11, 13) + 'h'
}

function diaRotulo(dataISO) {
  return dataISO.slice(8, 10) + '/' + dataISO.slice(5, 7)
}

// Agrupa as leituras horárias de um campo em pontos diários (média, mínima,
// máxima e soma) — TODOS os dias buscados (até 30); quem exibe decide
// quantos usar (ver `derivarVisaoPeriodo`). `soma` existe pra chuva, que se
// lê como total do dia, não como média (não faz sentido "temperatura média"
// virar "chuva média" — chove em rajadas, não constante o dia todo).
function agruparPorDia(horas, valores) {
  const porDia = new Map()

  horas.forEach((horaISO, indice) => {
    const chave = horaISO.slice(0, 10) // "AAAA-MM-DD"
    const lista = porDia.get(chave) ?? []
    lista.push(valores[indice])
    porDia.set(chave, lista)
  })

  return Array.from(porDia.entries()).map(([dataISO, lista]) => {
    const validos = lista.filter((valor) => valor != null)
    return {
      data: dataISO,
      rotulo: diaRotulo(dataISO),
      media: media(lista),
      minimo: validos.length ? Number(Math.min(...validos).toFixed(1)) : null,
      maximo: validos.length ? Number(Math.max(...validos).toFixed(1)) : null,
      soma: validos.length ? Number(validos.reduce((soma, valor) => soma + valor, 0).toFixed(1)) : null,
    }
  })
}

// Igual a `agruparPorDia`, mas específico pra vento: velocidade média,
// rajada máxima do dia e direção predominante (média circular).
function agruparVentoPorDia(horas, velocidades, rajadas, direcoes) {
  const porDia = new Map()

  horas.forEach((horaISO, indice) => {
    const chave = horaISO.slice(0, 10)
    const grupo = porDia.get(chave) ?? { velocidades: [], rajadas: [], direcoes: [] }
    grupo.velocidades.push(velocidades[indice])
    grupo.rajadas.push(rajadas[indice])
    grupo.direcoes.push(direcoes[indice])
    porDia.set(chave, grupo)
  })

  return Array.from(porDia.entries()).map(([dataISO, grupo]) => {
    const rajadasValidas = grupo.rajadas.filter((valor) => valor != null)
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
// anterior a ele — alimenta o card "Resumo do dia" (fixo: sempre hoje vs.
// ontem, independente do período escolhido lá em cima no gráfico/tabela).
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

// Formato que o Dashboard consome — ver pages/Dashboard.jsx. Guarda os
// dados HORÁRIOS e DIÁRIOS completos (últimos 30 dias) sem cortar nada —
// o corte por período (hoje/ontem/7/30) é feito depois, na hora de exibir
// (ver `derivarVisaoPeriodo`), sem precisar buscar de novo na API.
function normalizar(dados) {
  const atual = dados.current
  const horas = dados.hourly?.time ?? []
  const agora = new Date()

  // A Open-Meteo devolve algumas horas "futuras" (previsão do resto do dia
  // de hoje/amanhã, por causa de forecast_days=1) — descarta o que ainda
  // não aconteceu, senão "Hoje" mostraria previsão como se fosse leitura.
  const indiceLimite = horas.findIndex((horaISO) => new Date(horaISO) > agora)
  const fimValido = indiceLimite === -1 ? horas.length : indiceLimite
  const horasPassadas = horas.slice(0, fimValido)
  const corte = (lista) => lista.slice(0, fimValido)

  const horariaTemperatura = horasPassadas.map((h, i) => ({ dataHora: h, rotulo: horaRotulo(h), valor: corte(dados.hourly.temperature_2m)[i] }))
  const horariaUmidade = horasPassadas.map((h, i) => ({ dataHora: h, rotulo: horaRotulo(h), valor: corte(dados.hourly.relative_humidity_2m)[i] }))
  const horariaPressao = horasPassadas.map((h, i) => ({ dataHora: h, rotulo: horaRotulo(h), valor: corte(dados.hourly.surface_pressure)[i] }))
  const horariaChuva = horasPassadas.map((h, i) => ({ dataHora: h, rotulo: horaRotulo(h), valor: corte(dados.hourly.precipitation)[i] }))
  const horariaVento = horasPassadas.map((h, i) => ({
    dataHora: h,
    rotulo: horaRotulo(h),
    velocidade: corte(dados.hourly.wind_speed_10m)[i],
    rajada: corte(dados.hourly.wind_gusts_10m)[i],
    direcaoGraus: corte(dados.hourly.wind_direction_10m)[i],
    direcaoTexto: direcaoTexto(corte(dados.hourly.wind_direction_10m)[i]),
  }))

  const diariaTemperatura = agruparPorDia(horasPassadas, corte(dados.hourly.temperature_2m))
  const diariaUmidade = agruparPorDia(horasPassadas, corte(dados.hourly.relative_humidity_2m))
  const diariaPressao = agruparPorDia(horasPassadas, corte(dados.hourly.surface_pressure))
  const diariaChuva = agruparPorDia(horasPassadas, corte(dados.hourly.precipitation))
  const diariaVentoSimples = agruparPorDia(horasPassadas, corte(dados.hourly.wind_speed_10m))
  const diariaVento = agruparVentoPorDia(
    horasPassadas, corte(dados.hourly.wind_speed_10m), corte(dados.hourly.wind_gusts_10m), corte(dados.hourly.wind_direction_10m),
  )

  const resumoDia = calcularResumoDia(diariaTemperatura, diariaUmidade, diariaPressao, diariaVentoSimples)

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
    // `daily` só é pedido com forecast_days=1 (ver buscarClimaAtual) — o
    // nascer/pôr do sol de hoje já vem na posição 0 sem precisar de outra
    // chamada.
    nascerSol: dados.daily?.sunrise?.[0] ?? null,
    porSol: dados.daily?.sunset?.[0] ?? null,
    atualizadoEm: atual.time,
    resumoDia,
    horaria: { temperatura: horariaTemperatura, umidade: horariaUmidade, pressao: horariaPressao, chuva: horariaChuva, vento: horariaVento },
    diaria: { temperatura: diariaTemperatura, umidade: diariaUmidade, pressao: diariaPressao, chuva: diariaChuva, vento: diariaVento },
  }
}

export async function buscarClimaAtual(coordenadas = COORDENADAS_PADRAO) {
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
      'precipitation',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    daily: ['sunrise', 'sunset'].join(','),
    past_days: String(DIAS_HISTORICO_MAXIMO),
    forecast_days: '1',
    timezone: 'America/Sao_Paulo',
  })

  const resposta = await fetch(`${BASE_URL}?${parametros}`)
  if (!resposta.ok) {
    throw new Error('Não foi possível buscar os dados de clima.')
  }
  const dados = await resposta.json()
  return normalizar(dados)
}

function dataISODeslocada(diasAtras) {
  const data = new Date()
  data.setDate(data.getDate() - diasAtras)
  return data.toISOString().slice(0, 10)
}

// Deriva o que o gráfico/tabela do Dashboard devem mostrar pro período
// escolhido — 'hoje'/'ontem' (granularidade hora, sem médias) ou 7/30
// (granularidade dia, com médias — RN: só faz média quando mais de um dia
// está selecionado). Tudo calculado em cima do que `buscarClimaAtual` já
// buscou, sem nova chamada de API.
export function derivarVisaoPeriodo(clima, periodo) {
  const ehHoraAHora = periodo === 'hoje' || periodo === 'ontem'

  if (ehHoraAHora) {
    const dataAlvo = dataISODeslocada(periodo === 'hoje' ? 0 : 1)
    const filtrarDia = (lista) => lista.filter((ponto) => ponto.dataHora.startsWith(dataAlvo))

    const temperatura = filtrarDia(clima.horaria.temperatura)
    const umidade = filtrarDia(clima.horaria.umidade)
    const pressao = filtrarDia(clima.horaria.pressao)
    const chuva = filtrarDia(clima.horaria.chuva)
    const vento = filtrarDia(clima.horaria.vento)

    return {
      granularidade: 'hora',
      grafico: {
        temperatura: temperatura.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        umidade: umidade.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        pressao: pressao.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        chuva: chuva.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        vento: vento.map((p) => ({ rotulo: p.rotulo, valor: p.velocidade })),
      },
      tabela: {
        temperatura: [...temperatura].reverse(),
        umidade: [...umidade].reverse(),
        pressao: [...pressao].reverse(),
        chuva: [...chuva].reverse(),
        vento: [...vento].reverse(),
      },
      resumoTopo:
        periodo === 'hoje'
          ? {
              temperatura: clima.temperatura,
              umidade: clima.umidade,
              pressao: clima.pressao,
              chuva: clima.precipitacao,
              vento: clima.vento,
              maxMin: {
                temperatura: { maximo: clima.diaria.temperatura.at(-1)?.maximo, minimo: clima.diaria.temperatura.at(-1)?.minimo },
                umidade: { maximo: clima.diaria.umidade.at(-1)?.maximo, minimo: clima.diaria.umidade.at(-1)?.minimo },
                pressao: { maximo: clima.diaria.pressao.at(-1)?.maximo, minimo: clima.diaria.pressao.at(-1)?.minimo },
                chuva: { maximo: clima.diaria.chuva.at(-1)?.soma, minimo: 0 },
                vento: { maximo: clima.diaria.vento.at(-1)?.rajadaMaxima, minimo: null },
              },
            }
          : {
              temperatura: media(temperatura.map((p) => p.valor)),
              umidade: media(umidade.map((p) => p.valor)),
              pressao: media(pressao.map((p) => p.valor)),
              chuva: chuva.reduce((soma, p) => soma + (p.valor ?? 0), 0),
              vento: {
                velocidade: media(vento.map((p) => p.velocidade)),
                rajada: vento.length ? Math.max(...vento.map((p) => p.rajada).filter((v) => v != null)) : null,
                direcaoTexto: direcaoTexto(mediaCircular(vento.map((p) => p.direcaoGraus))),
              },
              maxMin: null,
            },
    }
  }

  const dias = periodo // 7 ou 30
  const temperatura = clima.diaria.temperatura.slice(-dias)
  const umidade = clima.diaria.umidade.slice(-dias)
  const pressao = clima.diaria.pressao.slice(-dias)
  const chuva = clima.diaria.chuva.slice(-dias)
  const vento = clima.diaria.vento.slice(-dias)

  return {
    granularidade: 'dia',
    grafico: {
      temperatura: temperatura.map((d) => ({ rotulo: d.rotulo, valor: d.media })),
      umidade: umidade.map((d) => ({ rotulo: d.rotulo, valor: d.media })),
      pressao: pressao.map((d) => ({ rotulo: d.rotulo, valor: d.media })),
      chuva: chuva.map((d) => ({ rotulo: d.rotulo, valor: d.soma })),
      vento: vento.map((d) => ({ rotulo: d.rotulo, valor: d.velocidadeMedia })),
    },
    tabela: {
      temperatura: [...temperatura].reverse(),
      umidade: [...umidade].reverse(),
      pressao: [...pressao].reverse(),
      chuva: [...chuva].reverse(),
      vento: [...vento].reverse(),
    },
    resumoTopo: {
      temperatura: media(temperatura.map((d) => d.media)),
      umidade: media(umidade.map((d) => d.media)),
      pressao: media(pressao.map((d) => d.media)),
      chuva: chuva.reduce((soma, d) => soma + (d.soma ?? 0), 0),
      maxMin: null,
      vento: {
        velocidade: media(vento.map((d) => d.velocidadeMedia)),
        rajada: vento.length ? Math.max(...vento.map((d) => d.rajadaMaxima).filter((v) => v != null)) : null,
        direcaoTexto: direcaoTexto(mediaCircular(vento.map((d) => d.direcaoGraus))),
      },
    },
  }
}
