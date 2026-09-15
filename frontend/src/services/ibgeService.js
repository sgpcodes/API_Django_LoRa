// As 27 UFs — pro seletor de Estado da página da estação (EstacaoCabecalho.jsx).
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// Resolve UF -> lista de municípios (código IBGE), usada pro seletor de
// Cidade e por components/PrevisaoSemana.jsx pra pedir a previsão do INMET.
// API pública do IBGE, direto do navegador — sem risco de CORS conhecido, e
// não precisa passar pelo backend (é só uma lista de nomes/códigos).
export async function buscarMunicipiosPorUf(uf) {
  if (!uf) return []
  const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
  if (!resposta.ok) throw new Error('Não foi possível buscar os municípios desse estado.')
  const dados = await resposta.json()
  return dados
    .map((item) => ({ codigo: String(item.id), nome: item.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
