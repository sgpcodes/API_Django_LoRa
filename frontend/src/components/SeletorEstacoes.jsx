import { MapPin, Check } from 'lucide-react'
import styles from './SeletorEstacoes.module.css'

// Cores dos ícones alternam em sequência, só pra diferenciar os cartões
// visualmente (não tem relação com tipo física/online — ver
// IndicadorTipoEstacao.jsx, que é outra informação) — mesma ideia de
// paleta categórica alternada que o resto do app já usa em listas.
const CORES = ['var(--metrica-pressao)', 'var(--metrica-umidade)', 'var(--metrica-vento)', 'var(--metrica-temperatura)', 'var(--metrica-chuva)']

function formatarCoordenada(valor, positivo, negativo) {
  const letra = valor >= 0 ? positivo : negativo
  return `${Math.abs(valor).toFixed(4)}° ${letra}`
}

// Linha de cartões, um por Estacao atribuída à conta (física ou online —
// ver Estacao.tipo) — RN: pode ter 1, 2, 3 ou mais (planos Pro/Plus
// permitem várias). Clicar troca qual estação está selecionada, que por
// sua vez refaz a busca de Leitura inteira (ver pages/Dashboard.jsx) —
// todo o resto da página (abas, cards, gráficos) acompanha a troca.
function SeletorEstacoes({ estacoes, estacaoSelecionadaId, onSelecionar }) {
  if (estacoes.length === 0) return null

  return (
    <div className={styles.painel}>
      <span className={styles.titulo}>Estações</span>
      <div className={styles.lista}>
        {estacoes.map((estacao, indice) => {
          const selecionada = estacao.id === estacaoSelecionadaId
          const cor = CORES[indice % CORES.length]
          const temCoordenadas = estacao.latitude != null && estacao.longitude != null
          const subtitulo = temCoordenadas
            ? `${formatarCoordenada(estacao.latitude, 'N', 'S')} · ${formatarCoordenada(estacao.longitude, 'L', 'O')}`
            : estacao.localizacao || '—'

          return (
            <button
              key={estacao.id}
              type="button"
              className={`${styles.cartao} ${selecionada ? styles.cartaoSelecionado : ''}`}
              onClick={() => onSelecionar(estacao.id)}
            >
              <span className={styles.icone} style={{ backgroundColor: cor }}>
                <MapPin size={16} color="#fff" />
              </span>
              <span className={styles.textos}>
                <span className={styles.nome}>{estacao.nome || estacao.identificador}</span>
                <span className={styles.subtitulo}>{subtitulo}</span>
              </span>
              <span className={`${styles.marcador} ${selecionada ? styles.marcadorSelecionado : ''}`}>
                {selecionada && <Check size={12} color="#fff" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SeletorEstacoes
