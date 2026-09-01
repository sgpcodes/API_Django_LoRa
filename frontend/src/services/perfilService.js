import api from './api'

export async function buscarMeuPerfil() {
  const resposta = await api.get('/api/usuarios/me/')
  return resposta.data
}

export async function atualizarMeuPerfil(id, dados) {
  const resposta = await api.patch(`/api/usuarios/${id}/`, dados)
  return resposta.data
}

export async function trocarMinhaSenha(id, senhaAtual, novaSenha) {
  await api.patch(`/api/usuarios/${id}/`, { senha_atual: senhaAtual, password: novaSenha })
}
