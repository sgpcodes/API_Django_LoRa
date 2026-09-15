// Só pra resolver UF -> lista de municípios (código IBGE), que
// components/PrevisaoSemana.jsx usa pra casar a cidade do perfil com um
// código de município e pedir a previsão do INMET pra ele. API pública do
// IBGE, direto do navegador — sem risco de CORS conhecido, e não precisa
// passar pelo backend (é só uma lista de nomes/códigos).
export async function buscarMunicipiosPorUf(uf) {
  if (!uf) return []
  const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
  if (!resposta.ok) throw new Error('Não foi possível buscar os municípios desse estado.')
  const dados = await resposta.json()
  return dados
    .map((item) => ({ codigo: String(item.id), nome: item.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
