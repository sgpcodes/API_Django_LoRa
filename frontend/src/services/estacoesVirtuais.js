// Piloto de estações virtuais (RF-11/RF-13 do documento da reunião):
// dado climático externo (Open-Meteo) entra no sistema com a identidade de
// uma estação própria — nome fictício, localidade e coordenadas GPS
// definidos aqui, nunca expostos como sendo do provedor externo.
//
// Por enquanto é uma lista fixa no front, sem CRUD nem model próprio no
// backend — decisão temporária pra validar o piloto de 4–5 estações antes
// de desenhar o cadastro de verdade (ver o parecer sobre Open-Meteo:
// faltam campos de GPS na Estacao real e um jeito de administrar isso).
// Também não tem nenhum bloqueio por plano ainda — toda conta Standard
// enxerga as 5; a regra de quantas/quais cada plano libera fica pra
// quando o cadastro virar de verdade (RF-03).
//
// `uf`/`cidade` têm que bater com a grafia do IBGE (usados por
// PrevisaoSemana.jsx pra achar o código do município e pedir a previsão
// do INMET) — todas na Região Metropolitana/Baixada Litorânea do Rio,
// perto da sede do LACOP em Maricá.
export const ESTACOES_VIRTUAIS = [
  { id: 'maricao', nome: 'Estação Mangueira', uf: 'RJ', cidade: 'Maricá', latitude: -22.9194, longitude: -42.8186 },
  { id: 'saquarema', nome: 'Estação Bacaxá', uf: 'RJ', cidade: 'Saquarema', latitude: -22.9199, longitude: -42.5093 },
  { id: 'itaborai', nome: 'Estação Itambi', uf: 'RJ', cidade: 'Itaboraí', latitude: -22.7439, longitude: -42.8592 },
  { id: 'riobonito', nome: 'Estação Boa Sorte', uf: 'RJ', cidade: 'Rio Bonito', latitude: -22.7228, longitude: -42.6272 },
  { id: 'tangua', nome: 'Estação Rio D’Ouro', uf: 'RJ', cidade: 'Tanguá', latitude: -22.7325, longitude: -42.7195 },
]

export function buscarEstacaoVirtual(id) {
  return ESTACOES_VIRTUAIS.find((estacao) => estacao.id === id) ?? ESTACOES_VIRTUAIS[0]
}
