import axios from 'axios'
import { logout, obterAccessToken, renovarAccessToken } from './authService'

// A URL base vem do .env (VITE_API_URL), para trocar de localhost para o
// Render sem precisar mexer em nenhum outro arquivo do projeto.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

// Toda chamada feita por esta instância (dashboard, planos, etc.) sai com o
// access token, se houver um salvo. Login e refresh não passam por aqui —
// authService.js usa axios "cru" pra eles, exatamente pra não entrar nesse
// interceptor (não faz sentido anexar um token vencido numa chamada que
// está tentando renovar esse mesmo token).
api.interceptors.request.use((config) => {
  const token = obterAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Se uma chamada volta 401 (access expirado), tenta renovar uma única vez
// com o refresh token e repete a chamada original — sem isso, o usuário
// seria deslogado a cada 30 minutos (vida do access token) mesmo estando
// ativo. Se a renovação falhar (refresh também vencido/inválido), desloga
// de verdade e manda pro login.
api.interceptors.response.use(
  (resposta) => resposta,
  async (erro) => {
    const requisicaoOriginal = erro.config

    if (erro.response?.status === 401 && !requisicaoOriginal._jaTentouRenovar) {
      requisicaoOriginal._jaTentouRenovar = true
      try {
        const novoAccessToken = await renovarAccessToken()
        requisicaoOriginal.headers.Authorization = `Bearer ${novoAccessToken}`
        return api(requisicaoOriginal)
      } catch {
        logout()
        window.location.href = '/login'
      }
    }

    return Promise.reject(erro)
  },
)

export default api
