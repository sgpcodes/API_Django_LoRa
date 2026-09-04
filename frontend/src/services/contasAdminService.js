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

export async function atualizarConta(id, dados) {
  const resposta = await api.patch(`/api/contas/${id}/`, dados)
  return resposta.data
}

// Bloqueado no backend se a conta ainda tiver estação(ões) vinculada(s)
// (RN15: toda estação tem dono, nunca fica órfã) — transferir ou remover
// a(s) estação(ões) primeiro, na tela de Estações ou no próprio card.
export async function excluirConta(id) {
  await api.delete(`/api/contas/${id}/`)
}

// Cria uma conta Usuário (Standard/Pro/Plus) direto pelo admin — dois
// passos: cadastro da conta (username = e-mail, mesma convenção do
// cadastro público) e a assinatura do plano escolhido, já marcada como
// `origem=gestor` (RN03) pelo próprio backend (AssinaturaViewSet.trocar_plano).
export async function criarConta({ nome, sobrenome, email, telefone, cep, rua, numero, cidade, estado, senha, planoId }) {
  const conta = await api.post('/api/contas/', {
    username: email,
    email,
    first_name: nome,
    last_name: sobrenome ?? '',
    telefone: telefone ?? '',
    cep: cep ?? '',
    rua: rua ?? '',
    numero: numero ?? '',
    cidade: cidade ?? '',
    estado: estado ?? '',
    password: senha,
  })
  await api.post('/api/assinaturas/trocar_plano/', { usuario: conta.data.id, plano: planoId })
  return conta.data
}
