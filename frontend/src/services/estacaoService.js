// Vínculo de estação meteorológica (Tela 3 da especificação de fluxo —
// conta Standard). Enquanto a estação LoRa própria não está pronta com
// todos os sensores, este vínculo é só simbólico: guarda o identificador
// digitado e localmente marca a conta como "já tem estação", pra decidir
// se o login cai direto no Dashboard ou passa por esta tela primeiro.
// Os dados climáticos exibidos vêm da API externa (climaExternoService)
// independentemente do identificador — trocar isso por um vínculo de
// verdade contra o backend (modelo Estacao já existe em api_rest) é o
// próximo passo, quando a estação própria estiver pronta.
import { obterClaimsDoToken } from './authService'

const CHAVE_BASE = 'agroclimatico_estacao_vinculada'

function chaveDoUsuario() {
  const username = obterClaimsDoToken()?.username ?? 'anonimo'
  return `${CHAVE_BASE}:${username}`
}

export function obterEstacaoVinculada() {
  const bruto = localStorage.getItem(chaveDoUsuario())
  if (!bruto) return null
  try {
    return JSON.parse(bruto)
  } catch {
    return null
  }
}

// Simula a validação descrita no PDF (Tela 3): identificador precisa ter
// pelo menos 4 caracteres. Sem backend real de estações por trás ainda,
// não há checagem de "já vinculada a outro usuário" — só o formato.
export async function vincularEstacao(identificador) {
  const limpo = identificador.trim()
  if (limpo.length < 4) {
    throw new Error('Estação não encontrada. Confira o identificador e tente de novo.')
  }

  const registro = { identificador: limpo, vinculadaEm: new Date().toISOString() }
  localStorage.setItem(chaveDoUsuario(), JSON.stringify(registro))
  return registro
}

// Usada pela tela de Configurações ("Estação e dados") — desfaz o vínculo
// simbólico. Na próxima vez que entrar, a conta passa pela Tela 3 de novo.
export function desvincularEstacao() {
  localStorage.removeItem(chaveDoUsuario())
}
