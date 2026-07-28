// O tema visual (cores) depende só do horário do computador do usuário.
// Das 7h às 18h59 é dia, do contrário é noite.
export function obterTemaPorHorario() {
  const hora = new Date().getHours()
  return hora >= 7 && hora < 19 ? 'dia' : 'noite'
}
