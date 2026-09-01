import { Download, FileText, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { METRICAS_CLIMA, OPCOES_PERIODO } from '../services/metricasClima'
import styles from './HistoricoDiarioTable.module.css'

// Tabela de histórico do Dashboard — sincronizada com o gráfico logo
// acima (mesmo índice de métrica e mesmo período, ver
// GraficoHistoricoCarrossel): trocar a métrica ou o período no gráfico
// troca as colunas e os dados aqui também.
//
// "Hoje"/"Ontem": uma linha por HORA, valor bruto (sem média — RN: só há
// média com mais de um dia selecionado). "7/30 dias": uma linha por DIA,
// com média/mínima/máxima. Rolagem vertical (não paginação) — são no
// máximo 24 linhas (hora) ou 30 linhas (dia).
function HistoricoDiarioTable({ tabela, indice, periodo, granularidade }) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false)
  const metrica = METRICAS_CLIMA[indice]
  const Icone = metrica.icone
  const linhas = tabela[metrica.chave] ?? []
  const ehVento = metrica.chave === 'vento'
  const ehPorHora = granularidade === 'hora'
  const rotuloPeriodo = OPCOES_PERIODO.find((opcao) => opcao.valor === periodo)?.rotulo

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Icone size={18} />
          Histórico {ehPorHora ? 'por hora' : 'diário'} · {metrica.titulo} · {rotuloPeriodo}
        </h2>
        <div className={styles.acoes}>
          <button type="button" className={styles.botaoSecundario}>
            <Download size={14} />
            Exportar dados (TXT)
          </button>
          <div className={styles.menuExportar}>
            <button
              type="button"
              className={styles.botaoPrimario}
              onClick={() => setMenuExportarAberto((atual) => !atual)}
            >
              <FileText size={14} />
              Exportar relatório (PDF)
              <ChevronDown size={14} />
            </button>
            {menuExportarAberto && (
              <div className={styles.dropdown}>
                <button type="button" className={styles.itemDropdown}>
                  Relatório completo (PDF)
                </button>
                <button type="button" className={styles.itemDropdown}>
                  Dados brutos (TXT)
                </button>
                <button type="button" className={styles.itemDropdown}>
                  Planilha (CSV)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabelaScroll}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>{ehPorHora ? 'Hora' : 'Data'}</th>
              {ehVento ? (
                <>
                  <th>Direção</th>
                  <th>{ehPorHora ? 'Velocidade' : 'Velocidade média'}</th>
                  <th>{ehPorHora ? 'Rajada' : 'Rajada máxima'}</th>
                </>
              ) : ehPorHora ? (
                <th>Valor</th>
              ) : (
                <>
                  <th>Média</th>
                  <th>Mínima</th>
                  <th>Máxima</th>
                </>
              )}
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const chave = linha.data ?? linha.dataHora
              if (ehVento) {
                return (
                  <tr key={chave}>
                    <td>{linha.rotulo}</td>
                    <td>
                      <span className={styles.direcao}>
                        <span
                          className={styles.setaDirecao}
                          style={{ transform: `rotate(${linha.direcaoGraus}deg)` }}
                        >
                          ↑
                        </span>
                        {linha.direcaoTexto} ({linha.direcaoGraus}°)
                      </span>
                    </td>
                    <td>{(ehPorHora ? linha.velocidade : linha.velocidadeMedia)?.toFixed(1)}</td>
                    <td>{(ehPorHora ? linha.rajada : linha.rajadaMaxima)?.toFixed(1)}</td>
                    <td>km/h</td>
                  </tr>
                )
              }
              if (ehPorHora) {
                return (
                  <tr key={chave}>
                    <td>{linha.rotulo}</td>
                    <td>{linha.valor?.toFixed(1)}</td>
                    <td>{metrica.unidade}</td>
                  </tr>
                )
              }
              return (
                <tr key={chave}>
                  <td>{linha.rotulo}</td>
                  <td>{linha.media?.toFixed(1)}</td>
                  <td>{linha.minimo?.toFixed(1)}</td>
                  <td>{linha.maximo?.toFixed(1)}</td>
                  <td>{metrica.unidade}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.legenda}>
        {linhas.length} {ehPorHora ? 'horas' : 'dias'} no histórico — role pra ver mais.
      </p>
    </div>
  )
}

export default HistoricoDiarioTable
