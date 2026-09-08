// Aba "Clima INMET" — dado meteorológico oficial (Instituto Nacional de
// Meteorologia), via o proxy do backend (app clima_externo). Não se mistura
// com o dado da própria estação ESP32 (ver climaEstacaoService.js).
import api from './api'

export async function buscarEstacoesInmet(uf) {
  const resposta = await api.get('/api/inmet/estacoes/', { params: uf ? { uf } : {} })
  return resposta.data
}

export async function buscarPrevisaoInmet(codigoIbge) {
  const resposta = await api.get(`/api/inmet/previsao/${codigoIbge}/`)
  return resposta.data
}

export async function buscarAvisosInmet(uf) {
  const resposta = await api.get('/api/inmet/avisos/', { params: uf ? { uf } : {} })
  return resposta.data
}
