// Status da sincronização local -> nuvem (só existe de verdade numa
// instalação Raspberry Pi com backup local — ver docker/backend/
// entrypoint.sh e api_rest/management/commands/sincronizar_leituras.py).
// Em qualquer outra instalação (Render), o backend responde
// `sincronizacao_configurada: false` e não há nada mais a interpretar.
import api from './api'

export async function buscarEstadoSincronizacao() {
  const resposta = await api.get('/api/sincronizacao/status/')
  return resposta.data
}
