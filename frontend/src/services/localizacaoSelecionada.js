// Estado/cidade escolhidos no cabeçalho do Dashboard (EstacaoCabecalho.jsx)
// — persistido no localStorage pra sobreviver a um F5. Extraído pra cá (em
// vez de ficar só dentro de Dashboard.jsx) porque a página de Exportação
// (ExportacaoDados.jsx) precisa da mesma cidade selecionada pra buscar os
// dados que vai exportar, sem duplicar as chaves/valores padrão em dois
// arquivos.
export const CHAVE_UF_SELECIONADA = 'lacop:ufSelecionada'
export const CHAVE_CIDADE_SELECIONADA = 'lacop:cidadeSelecionada'
export const UF_PADRAO = 'RJ'
export const CIDADE_PADRAO = 'Maricá'

export function obterLocalizacaoSelecionada() {
  return {
    uf: localStorage.getItem(CHAVE_UF_SELECIONADA) ?? UF_PADRAO,
    cidade: localStorage.getItem(CHAVE_CIDADE_SELECIONADA) ?? CIDADE_PADRAO,
  }
}
