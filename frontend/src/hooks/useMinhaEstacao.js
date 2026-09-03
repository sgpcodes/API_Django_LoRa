import { useEffect, useState } from 'react'
import { buscarMinhaEstacaoPrincipal } from '../services/estacaoService'

// A estação (real, vinda do backend) atribuída à conta logada — usado nos
// vários lugares que só precisam mostrar o identificador/status dela
// (Sidebar, Perfil, Configurações). Busca uma vez ao montar; quem
// precisar atualizar depois de uma mudança (ex.: Configurações) chama a
// própria API de novo por conta própria, sem depender deste hook.
export function useMinhaEstacao() {
  const [estacao, setEstacao] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    buscarMinhaEstacaoPrincipal()
      .then((dados) => {
        if (ativo) setEstacao(dados)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return { estacao, carregando }
}
