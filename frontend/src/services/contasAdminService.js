// Contas de Usuário (Standard/Pro/Plus) vistas pelo admin — usado pela
// tela de Gerenciamento de Contas do Painel Administrativo. `/api/contas/`
// já é restrito ao Gestor pra listar (ver contas/views.py:UsuarioViewSet).
import api from './api'

export async function buscarContas() {
  const resposta = await api.get('/api/contas/')
  return resposta.data.filter((conta) => conta.role === 'usuario')
}

export async function suspenderConta(id) {
  await api.post(`/api/contas/${id}/suspender/`)
}

export async function reativarConta(id) {
  await api.post(`/api/contas/${id}/reativar/`)
}
