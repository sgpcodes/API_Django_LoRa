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
export const DIAS_HISTORICO_MAXIMO = 30 // RN09/RN21 — teto do plano Standard
export const DIAS_PREVISAO_MAXIMO = 15 // mesma janela pedida à Open-Meteo (forecast_days)

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

export function descricaoTempo(codigo) {
  return DESCRICAO_POR_CODIGO[codigo] ?? 'Condição indisponível'
}

// Reduz os WMO Weather Codes da Open-Meteo às 5 condições que têm ícone
// próprio (assets/clima/*.png — ver PrevisaoSemana.jsx): não existe ícone
// de tempestade separado no material, então tempestade reaproveita o de
// chuva.
export function condicaoPorCodigo(codigo) {
  if (codigo == null) return 'sol'
  if (codigo === 95 || codigo === 96 || codigo === 99) return 'tempestade'
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86].includes(codigo)) return 'chuva'
  if (codigo === 3 || codigo === 45 || codigo === 48) return 'nublado'
  if (codigo === 2) return 'parcialmente-nublado'
  return 'sol' // 0 (céu limpo), 1 (predominantemente limpo)
}

function intensidadeVento(kmh) {
  if (kmh == null) return '—'
  if (kmh < 20) return 'Fraco'
  if (kmh < 40) return 'Moderado'
  return 'Forte'
}

// "2026-09-22" -> "terça-feira" (meio-dia fixo pra não cair no dia errado
// por causa de fuso horário no parse de "AAAA-MM-DD").
function diaSemanaTexto(dataISO) {
  return new Date(`${dataISO}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' })
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

  // Posição de "hoje" dentro de `daily.time` — não é 0: `past_days` (RN09)
  // desloca esse array também, não só o `hourly`. `atual.time` vem no
  // mesmo fuso pedido (America/Sao_Paulo) que `daily.time`, então compara
  // direto como texto sem risco de fuso horário diferente do navegador.
  const hojeISO = atual?.time?.slice(0, 10)
  const indiceHojeBusca = (dados.daily?.time ?? []).findIndex((data) => data >= hojeISO)
  const indiceHoje = indiceHojeBusca === -1 ? 0 : indiceHojeBusca

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
  const horariaRadiacao = horasPassadas.map((h, i) => ({ dataHora: h, rotulo: horaRotulo(h), valor: corte(dados.hourly.shortwave_radiation)[i] }))
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
  const diariaRadiacao = agruparPorDia(horasPassadas, corte(dados.hourly.shortwave_radiation))
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
    radiacao: atual.shortwave_radiation ?? null,
    visibilidadeKm: atual.visibility != null ? Number((atual.visibility / 1000).toFixed(1)) : null,
    condicaoTexto: descricaoTempo(atual.weather_code),
    // Nascer/pôr do sol de HOJE — `daily` também leva o `past_days` (RN09,
    // usado pros gráficos), então o índice 0 de `daily.time` não é hoje, é
    // 30 dias atrás (bug real: "Hoje" mostrava a data errada e o painel de
    // hora em hora de qualquer dia clicado vinha vazio, porque a data
    // "de hoje" usada era de um mês atrás). `indiceHoje` acha a posição
    // certa comparando com `current.time`, que vem no mesmo fuso horário
    // pedido (America/Sao_Paulo) que `daily.time` — não dá pra usar a data
    // do navegador aqui porque pode estar em outro fuso.
    nascerSol: dados.daily?.sunrise?.[indiceHoje] ?? null,
    porSol: dados.daily?.sunset?.[indiceHoje] ?? null,
    // Previsão de 15 dias (a partir de HOJE, ver `indiceHoje` acima) —
    // fonte única do card "Previsão do tempo" (components/PrevisaoSemana.jsx):
    // o INMET só dá 5 dias, então daqui pra baixo é tudo Open-Meteo (também
    // é de onde vem a rosa dos ventos e os gráficos, fica uma fonte só).
    previsaoDiaria: (dados.daily?.time ?? []).slice(indiceHoje).map((data, indiceRelativo) => {
      const i = indiceHoje + indiceRelativo
      return {
        data,
        diaSemana: diaSemanaTexto(data),
        tempMax: dados.daily?.temperature_2m_max?.[i] ?? null,
        tempMin: dados.daily?.temperature_2m_min?.[i] ?? null,
        chuvaProbabilidade: dados.daily?.precipitation_probability_max?.[i] ?? null,
        weatherCode: dados.daily?.weather_code?.[i] ?? null,
        condicao: condicaoPorCodigo(dados.daily?.weather_code?.[i]),
        ventoVelocidade: dados.daily?.wind_speed_10m_max?.[i] ?? null,
        ventoDirecaoTexto: direcaoTexto(dados.daily?.wind_direction_10m_dominant?.[i]),
        ventoIntensidade: intensidadeVento(dados.daily?.wind_speed_10m_max?.[i]),
      }
    }),
    // Previsão HORA A HORA (passado + futuro, sem cortar) — alimenta o
    // painel que abre ao clicar num dia em PrevisaoSemana.jsx. É a única
    // lista aqui que não corta o futuro: é o próprio ponto dela.
    previsaoHoraria: horas.map((h, i) => ({
      dataHora: h,
      data: h.slice(0, 10),
      hora: horaRotulo(h),
      temperatura: dados.hourly?.temperature_2m?.[i] ?? null,
      chuvaProbabilidade: dados.hourly?.precipitation_probability?.[i] ?? null,
      weatherCode: dados.hourly?.weather_code?.[i] ?? null,
      condicao: condicaoPorCodigo(dados.hourly?.weather_code?.[i]),
    })),
    atualizadoEm: atual.time,
    resumoDia,
    horaria: {
      temperatura: horariaTemperatura, umidade: horariaUmidade, pressao: horariaPressao,
      chuva: horariaChuva, radiacao: horariaRadiacao, vento: horariaVento,
    },
    diaria: {
      temperatura: diariaTemperatura, umidade: diariaUmidade, pressao: diariaPressao,
      chuva: diariaChuva, radiacao: diariaRadiacao, vento: diariaVento,
    },
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
      'shortwave_radiation',
    ].join(','),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'surface_pressure',
      'precipitation',
      'precipitation_probability',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'shortwave_radiation',
    ].join(','),
    daily: [
      'sunrise',
      'sunset',
      'precipitation_probability_max',
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
    ].join(','),
    past_days: String(DIAS_HISTORICO_MAXIMO),
    // Dias de previsão (pedido explícito) — teto da Open-Meteo é 16.
    forecast_days: String(DIAS_PREVISAO_MAXIMO),
    timezone: 'America/Sao_Paulo',
  })

  const resposta = await fetch(`${BASE_URL}?${parametros}`)
  if (!resposta.ok) {
    throw new Error('Não foi possível buscar os dados de clima.')
  }
  const dados = await resposta.json()
  return normalizar(dados)
}

// "AAAA-MM-DD" de hoje (ou `diasAtras` dias antes) NO FUSO LOCAL do
// navegador — bug real encontrado testando às 23:5x no Brasil (UTC-3):
// `.toISOString()` converte pra UTC antes de cortar a data, e UTC àquela
// hora já virou o dia seguinte. Com isso, "hoje" virava amanhã, o filtro
// de hora a hora não encontrava nenhum ponto (todos os dados são de
// HOJE de verdade) e os gráficos de Hoje/Ontem ficavam vazios — só o
// resumo do dia (Máx./Mín., de outra fonte) continuava aparecendo.
// `getFullYear`/`getMonth`/`getDate` leem no fuso local, sem esse risco.
export function dataISODeslocada(diasAtras) {
  const data = new Date()
  data.setDate(data.getDate() - diasAtras)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// Pontos crus de vento (velocidade + direção) pro período escolhido — pra
// rosa dos ventos (components/VentoRosa.jsx), que precisa da direção de
// cada leitura, não só da velocidade agregada que `derivarVisaoPeriodo`
// devolve em `grafico.vento`. Mesmo filtro de período que aquela função
// usa por baixo, só sem descartar a direção no meio do caminho.
export function derivarPontosVento(clima, periodo, rangePersonalizado) {
  const ehDiaUnicoPersonalizado =
    periodo === 'personalizado' && rangePersonalizado && rangePersonalizado.inicio === rangePersonalizado.fim
  const ehHoraAHora = periodo === 'hoje' || periodo === 'ontem' || ehDiaUnicoPersonalizado

  if (ehHoraAHora) {
    const dataAlvo = ehDiaUnicoPersonalizado ? rangePersonalizado.inicio : dataISODeslocada(periodo === 'hoje' ? 0 : 1)
    return clima.horaria.vento
      .filter((ponto) => ponto.dataHora.startsWith(dataAlvo))
      .map((p) => ({ velocidade: p.velocidade, direcaoGraus: p.direcaoGraus }))
  }

  if (periodo === 'personalizado') {
    return clima.diaria.vento
      .filter((d) => d.data >= rangePersonalizado.inicio && d.data <= rangePersonalizado.fim)
      .map((d) => ({ velocidade: d.velocidadeMedia, direcaoGraus: d.direcaoGraus }))
  }

  return clima.diaria.vento.slice(-periodo).map((d) => ({ velocidade: d.velocidadeMedia, direcaoGraus: d.direcaoGraus }))
}

function filtrarHorariaPorJanela(serieHoraria, diasAtras, quantidadeDias) {
  const fim = new Date()
  fim.setDate(fim.getDate() - diasAtras)
  fim.setHours(23, 59, 59, 999)
  const inicio = new Date(fim)
  inicio.setDate(inicio.getDate() - quantidadeDias + 1)
  inicio.setHours(0, 0, 0, 0)
  return serieHoraria.filter((ponto) => {
    const momento = new Date(ponto.dataHora)
    return momento >= inicio && momento <= fim
  })
}

function estatisticasDeJanela(pontos) {
  const validos = pontos.filter((p) => p.velocidade != null)
  if (validos.length === 0) {
    return { media: null, rajadaMaxima: null, rajadaHorario: null, menorVelocidade: null, menorHorario: null }
  }
  const mediaVelocidade = Number((validos.reduce((soma, p) => soma + p.velocidade, 0) / validos.length).toFixed(1))
  const comRajada = validos.filter((p) => p.rajada != null)
  const maiorRajada = comRajada.length ? comRajada.reduce((maior, p) => (p.rajada > maior.rajada ? p : maior)) : null
  const menor = validos.reduce((pior, p) => (p.velocidade < pior.velocidade ? p : pior))
  return {
    media: mediaVelocidade,
    rajadaMaxima: maiorRajada?.rajada ?? null,
    rajadaHorario: maiorRajada?.dataHora ?? null,
    menorVelocidade: menor.velocidade,
    menorHorario: menor.dataHora,
  }
}

// Resumo do card "Vento" (components/PainelVento.jsx): velocidade média
// (+ variação % contra o período anterior de mesmo tamanho), rajada máxima
// e menor velocidade — os dois últimos com o horário exato em que
// aconteceram, por isso usa sempre `clima.horaria.vento` (nunca a agregada
// `clima.diaria.vento`, que perde o horário) mesmo pra períodos de 7/30
// dias.
export function derivarResumoVento(clima, periodo, rangePersonalizado) {
  if (periodo === 'personalizado') {
    const dentroDoIntervalo = clima.horaria.vento.filter((ponto) => {
      const dataPonto = ponto.dataHora.slice(0, 10)
      return dataPonto >= rangePersonalizado.inicio && dataPonto <= rangePersonalizado.fim
    })
    // Sem "período anterior" pra comparar num intervalo arbitrário escolhido
    // à mão (a comparação original só faz sentido pra uma janela de
    // tamanho fixo terminando hoje) — deltaPct fica null, sem variação
    // mostrada, em vez de inventar uma comparação que não tem base clara.
    return { ...estatisticasDeJanela(dentroDoIntervalo), deltaPct: null }
  }

  const quantidadeDias = periodo === 'hoje' || periodo === 'ontem' ? 1 : periodo
  const diasAtras = periodo === 'ontem' ? 1 : 0

  const atual = estatisticasDeJanela(filtrarHorariaPorJanela(clima.horaria.vento, diasAtras, quantidadeDias))
  // Período anterior de mesmo tamanho, imediatamente antes — só existe dado
  // se couber dentro dos 30 dias de histórico (RN09); sem isso, `deltaPct`
  // fica null e o card simplesmente não mostra a variação.
  const anterior = estatisticasDeJanela(filtrarHorariaPorJanela(clima.horaria.vento, diasAtras + quantidadeDias, quantidadeDias))
  const deltaPct = atual.media != null && anterior.media ? Math.round(((atual.media - anterior.media) / anterior.media) * 100) : null

  return { ...atual, deltaPct }
}

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}/${mes}/${ano}`
}

// Intervalo de datas mostrado no seletor do card "Vento" (ex.: "16/09/2026
// – 22/09/2026") — sempre um período PASSADO terminando hoje (mesma janela
// que `derivarPontosVento`/`derivarVisaoPeriodo` usam pra 7/30 dias; os
// dados são de monitoramento real, não previsão futura).
export function intervaloDeDatas(periodo, rangePersonalizado) {
  if (periodo === 'hoje') return formatarDataBR(dataISODeslocada(0))
  if (periodo === 'ontem') return formatarDataBR(dataISODeslocada(1))
  if (periodo === 'personalizado' && rangePersonalizado) {
    return rangePersonalizado.inicio === rangePersonalizado.fim
      ? formatarDataBR(rangePersonalizado.inicio)
      : `${formatarDataBR(rangePersonalizado.inicio)} – ${formatarDataBR(rangePersonalizado.fim)}`
  }
  return `${formatarDataBR(dataISODeslocada(periodo - 1))} – ${formatarDataBR(dataISODeslocada(0))}`
}

// Máxima/mínima do dia `dataISO` (ex.: "2026-10-01") em `clima.diaria.*`
// — usado só no resumo de um único dia (granularidade hora); pra
// 7/30 dias (ou um intervalo personalizado de mais de um dia), cada
// ponto do gráfico já tem sua própria máxima/mínima (ver
// `derivarVisaoPeriodo` mais abaixo), não precisa desse helper.
function maxMinDoDia(clima, dataISO) {
  const doDia = (lista) => lista.find((d) => d.data === dataISO)
  return {
    temperatura: { maximo: doDia(clima.diaria.temperatura)?.maximo, minimo: doDia(clima.diaria.temperatura)?.minimo },
    umidade: { maximo: doDia(clima.diaria.umidade)?.maximo, minimo: doDia(clima.diaria.umidade)?.minimo },
    pressao: { maximo: doDia(clima.diaria.pressao)?.maximo, minimo: doDia(clima.diaria.pressao)?.minimo },
    chuva: { maximo: doDia(clima.diaria.chuva)?.soma, minimo: 0 },
    radiacao: { maximo: doDia(clima.diaria.radiacao)?.maximo, minimo: doDia(clima.diaria.radiacao)?.minimo },
    vento: { maximo: doDia(clima.diaria.vento)?.rajadaMaxima, minimo: null },
  }
}

// Deriva o que o gráfico/tabela do Dashboard devem mostrar pro período
// escolhido — 'hoje'/'ontem'/um dia personalizado único (granularidade
// hora, sem médias) ou 7/30/um intervalo personalizado de mais de um dia
// (granularidade dia, com médias — RN: só faz média quando mais de um
// dia está selecionado). Tudo calculado em cima do que `buscarClimaAtual`
// já buscou, sem nova chamada de API — por isso o intervalo
// personalizado só pode ir até onde esse período já cobre (ver
// DIAS_HISTORICO_MAXIMO/forecast_days em `buscarClimaAtual`).
//
// `rangePersonalizado` ({ inicio, fim }, datas ISO "AAAA-MM-DD") só é
// necessário quando `periodo === 'personalizado'`. `inicio === fim`
// vira um único dia (granularidade hora, igual Hoje/Ontem); datas
// diferentes viram um intervalo de dias (granularidade dia, igual
// 7/30 dias).
export function derivarVisaoPeriodo(clima, periodo, rangePersonalizado) {
  const ehDiaUnicoPersonalizado =
    periodo === 'personalizado' && rangePersonalizado && rangePersonalizado.inicio === rangePersonalizado.fim
  const ehHoraAHora = periodo === 'hoje' || periodo === 'ontem' || ehDiaUnicoPersonalizado

  if (ehHoraAHora) {
    const dataAlvo = ehDiaUnicoPersonalizado ? rangePersonalizado.inicio : dataISODeslocada(periodo === 'hoje' ? 0 : 1)
    const filtrarDia = (lista) => lista.filter((ponto) => ponto.dataHora.startsWith(dataAlvo))

    const temperatura = filtrarDia(clima.horaria.temperatura)
    const umidade = filtrarDia(clima.horaria.umidade)
    const pressao = filtrarDia(clima.horaria.pressao)
    const chuva = filtrarDia(clima.horaria.chuva)
    const radiacao = filtrarDia(clima.horaria.radiacao)
    const vento = filtrarDia(clima.horaria.vento)

    return {
      granularidade: 'hora',
      grafico: {
        temperatura: temperatura.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        umidade: umidade.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        pressao: pressao.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        chuva: chuva.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        radiacao: radiacao.map((p) => ({ rotulo: p.rotulo, valor: p.valor })),
        vento: vento.map((p) => ({ rotulo: p.rotulo, valor: p.velocidade })),
      },
      tabela: {
        temperatura: [...temperatura].reverse(),
        umidade: [...umidade].reverse(),
        pressao: [...pressao].reverse(),
        chuva: [...chuva].reverse(),
        radiacao: [...radiacao].reverse(),
        vento: [...vento].reverse(),
      },
      resumoTopo:
        periodo === 'hoje'
          ? {
              temperatura: clima.temperatura,
              umidade: clima.umidade,
              pressao: clima.pressao,
              chuva: clima.precipitacao,
              radiacao: clima.radiacao,
              vento: clima.vento,
              maxMin: maxMinDoDia(clima, dataAlvo),
            }
          : {
              // "Ontem" e um dia único personalizado não têm uma leitura
              // "atual" (só fazem sentido pro dia de hoje) — o resumo aqui
              // é a média das horas daquele dia já encerrado.
              temperatura: media(temperatura.map((p) => p.valor)),
              umidade: media(umidade.map((p) => p.valor)),
              pressao: media(pressao.map((p) => p.valor)),
              chuva: chuva.reduce((soma, p) => soma + (p.valor ?? 0), 0),
              radiacao: media(radiacao.map((p) => p.valor)),
              vento: {
                velocidade: media(vento.map((p) => p.velocidade)),
                rajada: vento.length ? Math.max(...vento.map((p) => p.rajada).filter((v) => v != null)) : null,
                direcaoTexto: direcaoTexto(mediaCircular(vento.map((p) => p.direcaoGraus))),
              },
              maxMin: maxMinDoDia(clima, dataAlvo),
            },
    }
  }

  let temperatura, umidade, pressao, chuva, radiacao, vento
  if (periodo === 'personalizado') {
    const dentroDoIntervalo = (d) => d.data >= rangePersonalizado.inicio && d.data <= rangePersonalizado.fim
    temperatura = clima.diaria.temperatura.filter(dentroDoIntervalo)
    umidade = clima.diaria.umidade.filter(dentroDoIntervalo)
    pressao = clima.diaria.pressao.filter(dentroDoIntervalo)
    chuva = clima.diaria.chuva.filter(dentroDoIntervalo)
    radiacao = clima.diaria.radiacao.filter(dentroDoIntervalo)
    vento = clima.diaria.vento.filter(dentroDoIntervalo)
  } else {
    const dias = periodo // 7 ou 30
    temperatura = clima.diaria.temperatura.slice(-dias)
    umidade = clima.diaria.umidade.slice(-dias)
    pressao = clima.diaria.pressao.slice(-dias)
    chuva = clima.diaria.chuva.slice(-dias)
    radiacao = clima.diaria.radiacao.slice(-dias)
    vento = clima.diaria.vento.slice(-dias)
  }

  return {
    granularidade: 'dia',
    grafico: {
      temperatura: temperatura.map((d) => ({ rotulo: d.rotulo, valor: d.media, maximo: d.maximo, minimo: d.minimo })),
      umidade: umidade.map((d) => ({ rotulo: d.rotulo, valor: d.media, maximo: d.maximo, minimo: d.minimo })),
      pressao: pressao.map((d) => ({ rotulo: d.rotulo, valor: d.media })),
      chuva: chuva.map((d) => ({ rotulo: d.rotulo, valor: d.soma })),
      radiacao: radiacao.map((d) => ({ rotulo: d.rotulo, valor: d.media })),
      vento: vento.map((d) => ({ rotulo: d.rotulo, valor: d.velocidadeMedia })),
    },
    tabela: {
      temperatura: [...temperatura].reverse(),
      umidade: [...umidade].reverse(),
      pressao: [...pressao].reverse(),
      chuva: [...chuva].reverse(),
      radiacao: [...radiacao].reverse(),
      vento: [...vento].reverse(),
    },
    resumoTopo: {
      temperatura: media(temperatura.map((d) => d.media)),
      umidade: media(umidade.map((d) => d.media)),
      pressao: media(pressao.map((d) => d.media)),
      chuva: chuva.reduce((soma, d) => soma + (d.soma ?? 0), 0),
      radiacao: media(radiacao.map((d) => d.media)),
      maxMin: null,
      vento: {
        velocidade: media(vento.map((d) => d.velocidadeMedia)),
        rajada: vento.length ? Math.max(...vento.map((d) => d.rajadaMaxima).filter((v) => v != null)) : null,
        direcaoTexto: direcaoTexto(mediaCircular(vento.map((d) => d.direcaoGraus))),
      },
    },
  }
}
