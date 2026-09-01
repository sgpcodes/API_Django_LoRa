import { Radio } from 'lucide-react'
import PaginaEmBranco from '../components/PaginaEmBranco'

// Página da estação vinculada — ainda em branco. A estação vai ter seus
// próprios dados (além dos climáticos já mostrados no Dashboard), mas o
// que exatamente ainda não foi definido.
function Estacao() {
  return <PaginaEmBranco icone={Radio} titulo="Estação" />
}

export default Estacao
