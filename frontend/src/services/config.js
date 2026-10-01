// URL base da API Django. Normalmente vem de VITE_API_URL (definida no
// .env local ou nas env vars do serviço de hospedagem do frontend). O
// fallback abaixo existe pra não deixar a aplicação inteira quebrada em
// silêncio (planos somem, login não funciona) só porque essa variável não
// foi configurada no build — aponta pro backend de produção no Render.
// 'same-origin' é um valor especial usado no build Docker (ver
// frontend/Dockerfile): a instalação local serve frontend e API no mesmo
// endereço (Nginx como proxy reverso), então a API fica em caminho relativo
// em vez de um domínio fixo — funciona em localhost, raspberrypi.local ou
// qualquer IP da rede, sem precisar saber o endereço de antemão.
const _apiUrl = import.meta.env.VITE_API_URL
export const API_BASE_URL = _apiUrl === 'same-origin' ? '' : _apiUrl || 'https://api-monitoramento-meteorologico.onrender.com'
