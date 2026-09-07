// Zona de risco do painel admin — apaga contas (exceto superusuário) e
// dados de clima já recebidos, sem tocar em Planos/Funcionalidades/
// Token de credenciamento. Ver contas/manutencao.py no backend (mesma
// lógica do comando de terminal `limpar_dados_operacionais`).
import api from './api'

export async function buscarResumoLimpeza() {
  const resposta = await api.get('/api/manutencao/limpar-dados/')
  return resposta.data
}

export async function executarLimpeza() {
  const resposta = await api.post('/api/manutencao/limpar-dados/', { confirmar: true })
  return resposta.data
}
