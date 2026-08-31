// URL base da API Django. Normalmente vem de VITE_API_URL (definida no
// .env local ou nas env vars do serviço de hospedagem do frontend). O
// fallback abaixo existe pra não deixar a aplicação inteira quebrada em
// silêncio (planos somem, login não funciona) só porque essa variável não
// foi configurada no build — aponta pro backend de produção no Render.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api-monitoramento-meteorologico.onrender.com'
