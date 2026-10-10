import { useState } from 'react'
import { Calendar, Check, CloudRain, Compass, Droplet, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import { atualizarVariaveisLiberadas } from '../services/estacaoService'
import styles from './TabelaPermissoesEstacao.module.css'

// As colunas "Card" e "Gráfico" controlam a MESMA permissão por trás
// (AcessoEstacao.variaveis_liberadas não distingue os dois ainda) —
// marcar/desmarcar qualquer uma das duas pra uma variável libera/tira
// as duas juntas. "Previsão do tempo" e "Balanço hídrico" ainda são só
// visuais (não fazem parte de AcessoEstacao.VARIAVEIS) — não persistem.
const VARIAVEIS = [
  { chave: 'temperatura', rotulo: 'Temperatura', Icone: Thermometer },
  { chave: 'umidade', rotulo: 'Umidade', Icone: Droplet },
  { chave: 'pressao', rotulo: 'Pressão atmosférica', Icone: Gauge },
  { chave: 'vento', rotulo: 'Vento', Icone: Wind },
  { chave: 'chuva', rotulo: 'Chuva', Icone: CloudRain },
  { chave: 'radiacao', rotulo: 'Radiação', Icone: Sun },
]

function Caixa({ marcado, onClick, rotulo, desabilitado }) {
  return (
    <button
      type="button"
      className={`${styles.caixa} ${marcado ? styles.caixaMarcada : ''}`}
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={marcado}
      aria-label={rotulo}
    >
      {marcado && <Check size={12} strokeWidth={3} />}
    </button>
  )
}

// Uma "tabelinha" de permissão por estação vinculada à conta: quais
// variáveis aquela conta pode ver NESTA estação (RF-02/RF-03) — card da
// variável continua aparecendo pra ela mesmo desmarcada, só o dado some
// (decisão explícita: não é a tela toda sumindo, ver
// aplicar_restricao_variaveis em api_rest/models.py). Uma estação por
// bloco — uma conta com várias estações vinculadas vê uma tabela pra
// cada uma, cada uma com a permissão dela própria.
function TabelaPermissoesEstacao({ estacao, usuarioId }) {
  const infoDaConta = estacao.usuarios_info?.find((u) => u.id === usuarioId)
  const [liberadas, setLiberadas] = useState(() => new Set(infoDaConta?.variaveis_liberadas ?? []))
  const [salvando, setSalvando] = useState(null)
  const [erro, setErro] = useState(null)
  const [previsao, setPrevisao] = useState(true)
  const [balancoHidrico, setBalancoHidrico] = useState(true)

  async function alternarVariavel(chave) {
    const antes = new Set(liberadas)
    const depois = new Set(liberadas)
    if (depois.has(chave)) depois.delete(chave)
    else depois.add(chave)

    setLiberadas(depois)
    setSalvando(chave)
    setErro(null)
    try {
      await atualizarVariaveisLiberadas(estacao.id, usuarioId, Array.from(depois))
    } catch {
      setLiberadas(antes) // reverte — o Gestor vê a caixa voltar sozinha se não salvou de verdade
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(null)
    }
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
                <Caixa
                  marcado={liberadas.has(chave)}
                  onClick={() => alternarVariavel(chave)}
                  rotulo={`Card de ${rotulo}`}
                  desabilitado={salvando === chave}
                />
              </td>
              <td>
                <Caixa
                  marcado={liberadas.has(chave)}
                  onClick={() => alternarVariavel(chave)}
                  rotulo={`Gráfico de ${rotulo}`}
                  desabilitado={salvando === chave}
                />
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
      {erro && <p className={styles.aviso}>{erro}</p>}
    </div>
  )
}

export default TabelaPermissoesEstacao
