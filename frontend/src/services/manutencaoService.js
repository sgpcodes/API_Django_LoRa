// Zona de risco do painel admin — apaga contas (exceto superusuário) e
// dados de clima já recebidos, sem tocar em Planos/Funcionalidades/
// Token de credenciamento. Ver contas/manutencao.py no backend (mesma
// lógica do comando de terminal `limpar_dados_operacionais`).
import api from './api'

export async function buscarResumoLimpeza() {
  const resposta = await api.get('/api/manutencao/limpar-dados/')
  return resposta.data
}

export async function executarLimpeza() {
  const resposta = await api.post('/api/manutencao/limpar-dados/', { confirmar: true })
  return resposta.data
}

// Painel de "entranhas do sistema": tamanho real do banco (com % de uso
// se DATABASE_QUOTA_GB estiver configurado), tamanho por categoria de
// tabela, contagem por tabela, leituras no período (+ tendência),
// leituras por mês, atividade recente e status das integrações externas
// (INMET/IBGE). Ver contas/views.py:InfoSistemaView. `dias` também
// define a janela de "leituras processadas" (30 por padrão).
export async function buscarInfoSistema(dias) {
  const resposta = await api.get('/api/manutencao/info-sistema/', { params: dias ? { dias } : {} })
  return resposta.data
}

// Versão leve do painel acima — só `atividade_recente` e
// `leituras_por_mes`, sem os pings síncronos em API externa (INMET/
// IBGE/Open-Meteo) nem o tamanho/contagem do banco. É o que o Dashboard
// administrativo (tela de entrada do Gestor) realmente usa; chamar
// buscarInfoSistema() ali deixava a entrada lenta à toa.
export async function buscarResumoDashboard() {
  const resposta = await api.get('/api/manutencao/resumo-dashboard/')
  return resposta.data
}

// Zona de risco menor que "apagar tudo": só leituras mais velhas que
// `dias` — não mexe em contas nem estações.
export async function buscarResumoLimpezaLeiturasAntigas(dias) {
  const resposta = await api.get('/api/manutencao/limpar-leituras-antigas/', { params: { dias } })
  return resposta.data
}

export async function executarLimpezaLeiturasAntigas(dias) {
  const resposta = await api.post('/api/manutencao/limpar-leituras-antigas/', { dias, confirmar: true })
  return resposta.data
}
