// Eventos reais de auditoria (estação cadastrada/usuários alterados) —
// alimenta a tela de Notificações do Gestor. Gestor only.
import api from './api'

export async function buscarAuditoriaRecente() {
  const resposta = await api.get('/api/auditoria/recentes/')
  return resposta.data
}
