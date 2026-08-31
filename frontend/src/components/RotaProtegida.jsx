import { Navigate, Outlet } from 'react-router-dom'
import { estaAutenticado } from '../services/authService'

// Envolve as rotas que exigem login (hoje, só o dashboard interno — "o
// plano de gerenciador"). Sem token salvo, manda pro login antes de
// renderizar qualquer coisa; o backend continua sendo quem de fato garante
// o acesso — isso aqui é só pra não mostrar a tela e deixar as chamadas de
// API estourarem 401 uma por uma.
function RotaProtegida() {
  if (!estaAutenticado()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export default RotaProtegida
