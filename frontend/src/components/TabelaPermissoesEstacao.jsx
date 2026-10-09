import { useState } from 'react'
import { Calendar, Check, CloudRain, Compass, Droplet, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import styles from './TabelaPermissoesEstacao.module.css'

// Só visual por enquanto (pedido explícito do Gestor): nenhum checkbox
// daqui chama a API ainda — é um mockup pra validar o formato antes de
// decidir como vai funcionar de verdade (provavelmente em cima do
// AcessoEstacao.variaveis_liberadas que já existe no backend, ver
// api_rest/models.py). Tudo nasce marcado — representa o acesso de hoje,
// sem restrição nenhuma.
const VARIAVEIS = [
  { chave: 'temperatura', rotulo: 'Temperatura', Icone: Thermometer },
  { chave: 'umidade', rotulo: 'Umidade', Icone: Droplet },
  { chave: 'pressao', rotulo: 'Pressão atmosférica', Icone: Gauge },
  { chave: 'vento', rotulo: 'Vento', Icone: Wind },
  { chave: 'chuva', rotulo: 'Chuva', Icone: CloudRain },
  { chave: 'radiacao', rotulo: 'Radiação', Icone: Sun },
]

function todasMarcadas() {
  const marcadas = {}
  VARIAVEIS.forEach(({ chave }) => {
    marcadas[chave] = true
  })
  return marcadas
}

function Caixa({ marcado, onClick, rotulo }) {
  return (
    <button
      type="button"
      className={`${styles.caixa} ${marcado ? styles.caixaMarcada : ''}`}
      onClick={onClick}
      aria-pressed={marcado}
      aria-label={rotulo}
    >
      {marcado && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

// Uma "tabelinha" de permissão por estação vinculada à conta: quais
// variáveis aparecem como card-resumo, quais aparecem como gráfico, e se
// as abas de Previsão do tempo / Balanço hídrico aparecem pra essa conta
// nessa estação especificamente. Uma estação por bloco — uma conta com
// várias estações vinculadas vê uma tabela pra cada uma.
function TabelaPermissoesEstacao({ estacao }) {
  const [cards, setCards] = useState(todasMarcadas)
  const [graficos, setGraficos] = useState(todasMarcadas)
  const [previsao, setPrevisao] = useState(true)
  const [balancoHidrico, setBalancoHidrico] = useState(true)

  function alternar(setEstado, chave) {
    setEstado((atual) => ({ ...atual, [chave]: !atual[chave] }))
  }

  return (
    <div className={styles.bloco}>
      <div className={styles.cabecalhoBloco}>
        <Compass size={13} />
        <span className={styles.nomeEstacao}>{estacao.nome || estacao.identificador}</span>
      </div>

      <table className={styles.tabela}>
        <thead>
          <tr>
            <th className={styles.colunaRotulo}>Variável</th>
            <th>Card</th>
            <th>Gráfico</th>
          </tr>
        </thead>
        <tbody>
          {VARIAVEIS.map(({ chave, rotulo, Icone }) => (
            <tr key={chave}>
              <td className={styles.colunaRotulo}>
                <Icone size={13} />
                {rotulo}
              </td>
              <td>
                <Caixa marcado={cards[chave]} onClick={() => alternar(setCards, chave)} rotulo={`Card de ${rotulo}`} />
              </td>
              <td>
                <Caixa marcado={graficos[chave]} onClick={() => alternar(setGraficos, chave)} rotulo={`Gráfico de ${rotulo}`} />
              </td>
            </tr>
          ))}
          <tr className={styles.linhaAba}>
            <td className={styles.colunaRotulo}>
              <Calendar size={13} />
              Previsão do tempo
            </td>
            <td colSpan={2}>
              <Caixa marcado={previsao} onClick={() => setPrevisao((v) => !v)} rotulo="Mostrar aba Previsão do tempo" />
            </td>
          </tr>
          <tr className={styles.linhaAba}>
            <td className={styles.colunaRotulo}>
              <Droplet size={13} />
              Balanço hídrico
            </td>
            <td colSpan={2}>
              <Caixa
                marcado={balancoHidrico}
                onClick={() => setBalancoHidrico((v) => !v)}
                rotulo="Mostrar aba Balanço hídrico"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default TabelaPermissoesEstacao
