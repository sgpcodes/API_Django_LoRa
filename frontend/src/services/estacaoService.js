// Estações — lido direto do backend (modelo Estacao em api_rest). O
// backend já filtra sozinho por papel (RN15): um Usuário comum só vê as
// suas; o Gestor vê todas (usado pela tela de Estações do admin).
// Vincular/desvincular deixou de ser algo que o Usuário faz sozinho: só o
// admin atribui uma estação a uma conta (ver ContasAdmin.jsx) — cadastro
// de Estacao é feito ali, chamando este mesmo endpoint via `atribuirEstacao`.
import api from './api'

export async function buscarEstacoes() {
  const resposta = await api.get('/api/estacoes/')
  return resposta.data
}

// A conta pode ter mais de uma estação (planos Pro/Plus), mas o Dashboard
// mostra só uma — a atribuída mais recentemente (maior id), até existir
// um seletor de estação na interface.
export async function buscarMinhaEstacaoPrincipal() {
  const estacoes = await buscarEstacoes()
  if (estacoes.length === 0) return null
  return estacoes.reduce((mais_recente, atual) => (atual.id > mais_recente.id ? atual : mais_recente))
}

// GET /api/estacoes/orfas/ — sensor_id que já mandaram leitura mas ainda
// não têm Estacao cadastrada (Gestor only).
export async function buscarSensoresOrfaos() {
  const resposta = await api.get('/api/estacoes/orfas/')
  return resposta.data
}

// Cadastra uma nova Estacao a partir de um sensor órfão, já vinculada a
// uma ou mais contas — é o "vincular estação" do admin (RN15: toda
// Estacao nasce com pelo menos uma conta vinculada, nunca fica solta).
// Não existe "dono" único: a mesma estação pode ter quantas contas o
// Gestor quiser, todas com o mesmo nível de acesso.
export async function atribuirEstacao({ identificador, usuarioIds, nome, localizacao }) {
  const resposta = await api.post('/api/estacoes/', {
    identificador,
    usuarios: usuarioIds,
    nome: nome ?? '',
    localizacao: localizacao ?? '',
  })
  return resposta.data
}

// Substitui a lista de contas vinculadas a uma estação já cadastrada —
// admin só, em qualquer plano (RN15). O limite de estações do plano de
// cada conta NOVA na lista é validado no backend do mesmo jeito que na
// atribuição inicial (contas que já estavam vinculadas não são recontadas).
export async function atualizarUsuariosEstacao(estacaoId, usuarioIds) {
  const resposta = await api.patch(`/api/estacoes/${estacaoId}/`, { usuarios: usuarioIds })
  return resposta.data
}

// Remove uma estação cadastrada inteira (todas as contas perdem o
// vínculo de uma vez) — admin only. O histórico de leituras dela não é
// apagado (fica com `estacao=null`), só o cadastro.
export async function removerEstacao(estacaoId) {
  await api.delete(`/api/estacoes/${estacaoId}/`)
}

// Edita nome/intervalo de envio/limite offline/ativa de uma estação já
// cadastrada — admin ou qualquer conta vinculada podem (mudar a lista de
// contas continua exclusiva do admin, ver atualizarUsuariosEstacao).
export async function atualizarEstacao(estacaoId, dados) {
  const resposta = await api.patch(`/api/estacoes/${estacaoId}/`, dados)
  return resposta.data
}

// Apaga as leituras soltas (sem Estacao vinculada) de um sensor_id —
// limpeza de dado de teste/typo direto pela tela de Estações, sem
// precisar do Django Admin. Só atinge leituras órfãs (admin only); um
// sensor com Estacao cadastrada não pode ser limpo por aqui.
export async function apagarLeiturasOrfas(sensorId) {
  const resposta = await api.delete(`/api/leituras/orfas/${sensorId}/`)
  return resposta.data
}
