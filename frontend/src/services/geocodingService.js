// Geocoding API do Open-Meteo — mesmo provedor do clima (climaExternoService.js),
// sem chave, de graça. Só resolve "nome de cidade + estado" -> coordenada:
// o IBGE dá o catálogo de município (ver ibgeService.js), mas não dá
// latitude/longitude nenhuma — sem isso não dá pra perguntar nada ao
// Open-Meteo, que só aceita coordenada, nunca nome de lugar.
const BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

// Nome completo do estado (o resultado da geocodificação vem com o nome
// por extenso em `admin1`, não a sigla) — usado só pra desempatar quando
// o mesmo nome de cidade existe em mais de um estado (ex.: "Bom Jesus"
// existe em pelo menos 4 estados brasileiros).
const NOME_POR_UF = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

function normalizarTexto(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Devolve { latitude, longitude } da cidade brasileira pedida, ou lança se
// não achar nenhum resultado. Filtra por país (Brasil) e, quando dá pra
// bater o nome do estado, prioriza esse resultado — nomes de município
// repetem entre estados com uma frequência real no Brasil.
export async function geocodificarCidade(cidade, uf) {
  const parametros = new URLSearchParams({ name: cidade, count: '10', language: 'pt', countryCode: 'BR' })
  const resposta = await fetch(`${BASE_URL}?${parametros}`)
  if (!resposta.ok) throw new Error('Não foi possível localizar essa cidade.')
  const dados = await resposta.json()
  const resultados = dados.results ?? []
  if (resultados.length === 0) throw new Error('Cidade não encontrada.')

  const nomeEstado = normalizarTexto(NOME_POR_UF[uf])
  const doEstadoCerto = resultados.find((item) => normalizarTexto(item.admin1) === nomeEstado)
  const escolhido = doEstadoCerto ?? resultados[0]

  return { latitude: escolhido.latitude, longitude: escolhido.longitude }
}
