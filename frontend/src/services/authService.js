// Autenticação via JWT (backend: djangorestframework-simplejwt). Guarda os
// tokens no localStorage — simples e suficiente para o estágio atual do
// projeto (ferramenta interna, sem dado de pagamento no frontend); se um dia
// isso precisar de mais proteção contra XSS, a alternativa é mover o refresh
// token para um cookie httpOnly emitido pelo backend.
//
// Usa axios direto (não o `api` de services/api.js) porque api.js depende
// deste módulo para anexar/renovar o token — importar api.js aqui de volta
// criaria um import circular.
import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_URL

const CHAVE_ACCESS = 'agroclimatico_access_token'
const CHAVE_REFRESH = 'agroclimatico_refresh_token'
const CHAVE_CONTAS_SALVAS = 'agroclimatico_contas_salvas'

export function obterAccessToken() {
  return localStorage.getItem(CHAVE_ACCESS)
}

export function obterRefreshToken() {
  return localStorage.getItem(CHAVE_REFRESH)
}

function salvarTokens({ access, refresh }) {
  localStorage.setItem(CHAVE_ACCESS, access)
  if (refresh) localStorage.setItem(CHAVE_REFRESH, refresh)
}

export function estaAutenticado() {
  return Boolean(obterAccessToken())
}

// O JWT carrega "role"/"username"/"precisa_recredenciar" como claims —
// decodificamos só a parte do meio (payload) do token, sem precisar de
// nenhuma biblioteca: um JWT é "header.payload.assinatura" em base64url, e
// só o payload nos interessa aqui (a assinatura quem confere é o backend).
export function obterClaimsDoToken() {
  const token = obterAccessToken()
  if (!token) return null
  try {
    const payloadBase64Url = token.split('.')[1]
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(payloadBase64))
    return {
      role: payload.role ?? null,
      username: payload.username ?? null,
      precisaRecredenciar: Boolean(payload.precisa_recredenciar),
    }
  } catch {
    return null
  }
}

export function obterPapelDoToken() {
  return obterClaimsDoToken()?.role ?? null
}

// "Contas salvas neste navegador" — só os identificadores (e-mail/usuário)
// já usados aqui, pra tela de login oferecer "entrar com esta conta, só
// falta a senha" em vez de pedir usuário de novo toda vez. Isso NÃO é
// sessão múltipla (só um par de tokens fica ativo por vez) — é apenas uma
// lista de atalho.
export function obterContasSalvas() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CONTAS_SALVAS)) ?? []
  } catch {
    return []
  }
}

function lembrarConta(username) {
  const atuais = obterContasSalvas()
  if (atuais.includes(username)) return
  localStorage.setItem(CHAVE_CONTAS_SALVAS, JSON.stringify([...atuais, username]))
}

export function esquecerConta(username) {
  const restantes = obterContasSalvas().filter((conta) => conta !== username)
  localStorage.setItem(CHAVE_CONTAS_SALVAS, JSON.stringify(restantes))
}

export async function login(username, password) {
  const resposta = await axios.post(`${apiBaseUrl}/api/auth/token/`, { username, password })
  salvarTokens(resposta.data)
  lembrarConta(username)
  return resposta.data
}

// Cadastro público (tela "Criar conta"): dois caminhos —
// { email, nomeCompleto, cpf, password, confirmarSenha, planoId } vira
// Usuário comum com aquele plano; trocar `planoId` por `tokenCredenciamento`
// vira Gestor. NÃO loga automaticamente: o cadastro só se completa de
// verdade com o e-mail confirmado (link que chega por e-mail) — o login
// (função `login` acima) só funciona depois disso.
export async function cadastrar({ email, nomeCompleto, cpf, password, confirmarSenha, planoId, tokenCredenciamento }) {
  const resposta = await axios.post(`${apiBaseUrl}/api/auth/cadastro/`, {
    email,
    nome_completo: nomeCompleto,
    cpf,
    password,
    confirmar_senha: confirmarSenha,
    ...(planoId ? { plano: planoId } : {}),
    ...(tokenCredenciamento ? { token_credenciamento: tokenCredenciamento } : {}),
  })
  return resposta.data
}

// Pra quem cadastrou mas ainda não recebeu/perdeu o e-mail de
// confirmação e por isso nem consegue logar pra pedir reenvio pela via
// autenticada — este aqui não exige login.
export async function reenviarConfirmacaoPublico(email) {
  const resposta = await axios.post(`${apiBaseUrl}/api/auth/reenviar-confirmacao-publico/`, { email })
  return resposta.data
}

export function logout() {
  localStorage.removeItem(CHAVE_ACCESS)
  localStorage.removeItem(CHAVE_REFRESH)
}

// Troca o refresh token por um access token novo — chamado pelo
// interceptor do api.js quando uma chamada volta 401 (access expirado).
export async function renovarAccessToken() {
  const refresh = obterRefreshToken()
  if (!refresh) throw new Error('Sem refresh token salvo.')

  const resposta = await axios.post(`${apiBaseUrl}/api/auth/token/refresh/`, { refresh })
  salvarTokens(resposta.data)
  return resposta.data.access
}

// Envia o token de credenciamento (novo, depois de uma rotação; ou pela
// primeira vez, pra virar Gestor a partir de uma conta comum). Precisa do
// access token atual (a conta já está logada, só sem — ou perdendo — o
// privilégio de Gestor) — por isso o header vai anexado à mão aqui, sem
// passar pelo `api` de api.js (evita o import circular de sempre).
export async function recredenciar(tokenCredenciamento) {
  const resposta = await axios.post(
    `${apiBaseUrl}/api/auth/recredenciar/`,
    { token: tokenCredenciamento },
    { headers: { Authorization: `Bearer ${obterAccessToken()}` } },
  )
  salvarTokens(resposta.data)
  return resposta.data
}

// Confirmação de e-mail — chamado pela página que o link do e-mail abre
// (uidb64/token vêm da própria URL, sem precisar de login: é o link em
// si que autentica a ação).
export async function confirmarEmail(uidb64, token) {
  const resposta = await axios.post(`${apiBaseUrl}/api/auth/confirmar-email/`, { uidb64, token })
  return resposta.data
}
