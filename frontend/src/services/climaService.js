// O tema visual (cores) depende só do horário do computador do usuário.
// Das 7h às 18h59 é dia, do contrário é noite.
export function obterTemaPorHorario() {
  const hora = new Date().getHours()
  return hora >= 7 && hora < 19 ? 'dia' : 'noite'
}

// Já a mensagem de condição do clima depende só da temperatura, e não
// tem mais relação nenhuma com o tema de cores.
export function obterCondicaoClima(temperatura) {
  if (temperatura < 25) return 'Frio'
  if (temperatura <= 30) return 'Temperatura agradável'
  return 'Dia quente'
}
