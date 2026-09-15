// O Dashboard (Standard) parou de ler leitura bruta da estação real —
// desde a fusão com o Clima INMET, os dados vêm todos da API externa (ver
// climaExternoService.js). O que sobra aqui é só `direcaoTexto`, ainda
// usado pelo painel do admin (ContaAdminCard.jsx) pra mostrar a direção do
// vento cru que a ESP32 manda em `dados_adicionais`, quando existe.
const PONTOS_CARDEAIS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']

export function direcaoTexto(graus) {
  if (graus == null) return '—'
  const indice = Math.round(graus / 45) % 8
  return PONTOS_CARDEAIS[indice]
}
