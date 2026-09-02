import api from './api'

export async function buscarMeuPerfil() {
  const resposta = await api.get('/api/contas/me/')
  return resposta.data
}

export async function atualizarMeuPerfil(id, dados) {
  const resposta = await api.patch(`/api/contas/${id}/`, dados)
  return resposta.data
}

export async function trocarMinhaSenha(id, senhaAtual, novaSenha) {
  await api.patch(`/api/contas/${id}/`, { senha_atual: senhaAtual, password: novaSenha })
}
