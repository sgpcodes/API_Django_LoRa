import api from './api'

// Pública (não exige login) — alimenta os cards de plano da tela de
// cadastro. Ver PlanoViewSet.get_permissions no backend.
export async function buscarPlanos() {
  const resposta = await api.get('/api/planos/')
  return resposta.data
}
