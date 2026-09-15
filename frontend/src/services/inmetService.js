// Previsão de 5 dias por município (INMET), via o proxy do backend (app
// clima_externo) — usada só pelo bloco "Previsão da semana" da página da
// estação (ver components/PrevisaoSemana.jsx). Não se mistura com o dado
// da própria estação ESP32 (ver climaEstacaoService.js).
//
// `buscarEstacoesInmet`/`buscarAvisosInmet` existiam aqui pra alimentar a
// antiga aba "Clima INMET" (lista de estações oficiais + avisos), que foi
// removida quando essa aba foi incorporada ao Dashboard — os endpoints
// continuam existindo no backend (clima_externo/views.py) se precisarem
// voltar a ser usados, só não têm mais consumidor no front.
import api from './api'

export async function buscarPrevisaoInmet(codigoIbge) {
  const resposta = await api.get(`/api/inmet/previsao/${codigoIbge}/`)
  return resposta.data
}
