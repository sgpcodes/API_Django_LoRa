import axios from 'axios'

// A URL base vem do .env (VITE_API_URL), para trocar de localhost para o
// Render sem precisar mexer em nenhum outro arquivo do projeto.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

export default api
