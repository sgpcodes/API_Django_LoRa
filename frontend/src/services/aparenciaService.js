// Cor de destaque personalizável (tela Configurações → Aparência) e tema
// dia/noite (alternado pelo botão na sidebar). Os dois ficam salvos por
// conta (mesmo padrão de estacaoService.js) até a pessoa escolher outro —
// só mudam quando ela clica de novo, nunca sozinhos (nem por horário).
import { obterClaimsDoToken } from './authService'
import { obterTemaPorHorario } from './climaService'

const CHAVE_BASE = 'agroclimatico_cor_principal'
const CHAVE_TEMA_BASE = 'agroclimatico_tema'

export const CORES_PRINCIPAIS = [
  { valor: 'azul', hex: '#2f6fed' },
  { valor: 'verde', hex: '#22c55e' },
  { valor: 'roxo', hex: '#8b5cf6' },
  { valor: 'laranja', hex: '#f59e0b' },
  { valor: 'vermelho', hex: '#ef4444' },
  { valor: 'rosa', hex: '#ec4899' },
]

function chaveDoUsuario() {
  const username = obterClaimsDoToken()?.username ?? 'anonimo'
  return `${CHAVE_BASE}:${username}`
}

export function obterCorPrincipal() {
  return localStorage.getItem(chaveDoUsuario()) ?? 'azul'
}

export function salvarCorPrincipal(valor) {
  localStorage.setItem(chaveDoUsuario(), valor)
}

function chaveTemaDoUsuario() {
  const username = obterClaimsDoToken()?.username ?? 'anonimo'
  return `${CHAVE_TEMA_BASE}:${username}`
}

// Sem escolha salva ainda (primeira visita): sugere pelo horário, só como
// ponto de partida — a partir da primeira troca manual, fica só no que a
// pessoa escolheu, para sempre (até ela trocar de novo).
export function obterTema() {
  return localStorage.getItem(chaveTemaDoUsuario()) ?? obterTemaPorHorario()
}

export function salvarTema(valor) {
  localStorage.setItem(chaveTemaDoUsuario(), valor)
}

function hexDaCor(valor) {
  return CORES_PRINCIPAIS.find((cor) => cor.valor === valor)?.hex ?? CORES_PRINCIPAIS[0].hex
}

function hexParaRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Variáveis CSS que dependem da cor de destaque — aplicadas como estilo
// inline no elemento raiz do app (AppLayout), que bate em especificidade
// as declarações padrão de styles/theme.css (por [data-theme=...]) sem
// precisar editar aquele arquivo. Cascka pra qualquer componente dentro
// (Sidebar incluída), porque custom property é herdada normalmente.
export function variaveisCssDaCor(valor) {
  const hex = hexDaCor(valor)
  return {
    '--color-accent': hex,
    '--chart-line': hex,
    '--color-pill-ativo-bg': hex,
    '--color-sidebar-selecionado-bg': hex,
    '--color-sidebar-text-ativo': hex,
    '--chart-area-inicio': hexParaRgba(hex, 0.35),
    '--chart-area-fim': hexParaRgba(hex, 0),
    '--color-pill-bg': hexParaRgba(hex, 0.08),
    '--color-table-linha-hover': hexParaRgba(hex, 0.05),
  }
}
