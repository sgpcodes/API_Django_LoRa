import { useState } from 'react'
import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import styles from './HistoryTable.module.css'

const LINHAS_POR_PAGINA = 5

function formatarRotuloDia(data) {
  const hoje = new Date()
  const ontem = new Date(hoje)
  ontem.setDate(hoje.getDate() - 1)

  const dataFormatada = data.toLocaleDateString('pt-BR')

  if (data.toDateString() === hoje.toDateString()) return `${dataFormatada} (Hoje)`
  if (data.toDateString() === ontem.toDateString()) return `${dataFormatada} (Ontem)`

  const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
  return `${dataFormatada} (${diaSemanaCapitalizado})`
}

// Tabela com o histórico diário do período selecionado no filtro — cada
// linha é um dia, calculado a partir das leituras daquele dia (veja
// agruparPorDia em services/leiturasService.js).
function HistoryTable({ dias }) {
  const [quantidadeVisivel, setQuantidadeVisivel] = useState(LINHAS_POR_PAGINA)

  // Mais recente primeiro, como numa lista de histórico.
  const diasEmOrdem = [...dias].reverse()
  const diasVisiveis = diasEmOrdem.slice(0, quantidadeVisivel)
  const temMaisLinhas = quantidadeVisivel < diasEmOrdem.length

  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <CalendarClock size={18} />
        Histórico diário
      </h2>

      {diasEmOrdem.length === 0 ? (
        <p className={styles.vazio}>Nenhuma leitura no período selecionado.</p>
      ) : (
        <>
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Temp. média</th>
                  <th>Temp. máx</th>
                  <th>Temp. mín</th>
                  <th>Umidade média</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {diasVisiveis.map((dia) => (
                  <tr key={dia.data.toISOString()}>
                    <td>{formatarRotuloDia(dia.data)}</td>
                    <td>{dia.temperaturaMedia}°C</td>
                    <td className={styles.max}>{dia.temperaturaMaxima}°C</td>
                    <td className={styles.min}>{dia.temperaturaMinima}°C</td>
                    <td>{dia.umidadeMedia}%</td>
                    <td className={styles.seta}>
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {temMaisLinhas && (
            <button
              type="button"
              className={styles.verMais}
              onClick={() => setQuantidadeVisivel((quantidade) => quantidade + LINHAS_POR_PAGINA)}
            >
              Ver mais
              <ChevronDown size={16} />
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default HistoryTable
