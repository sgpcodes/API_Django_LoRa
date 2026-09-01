import { Download, FileText, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { METRICAS_CLIMA } from '../services/metricasClima'
import styles from './HistoricoDiarioTable.module.css'

// Tabela de histórico diário do Dashboard — sincronizada com o gráfico
// logo acima (mesmo índice de métrica, ver GraficoHistoricoCarrossel):
// trocar a métrica no gráfico troca as colunas e os dados aqui também.
// Uma linha por dia, com rolagem vertical (não paginação) — são só ~30
// linhas no máximo (limite de histórico do plano Standard).
function HistoricoDiarioTable({ tabela, indice, diasHistorico }) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false)
  const metrica = METRICAS_CLIMA[indice]
  const Icone = metrica.icone
  const linhas = tabela[metrica.chave] ?? []
  const ehVento = metrica.chave === 'vento'

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Icone size={18} />
          Histórico diário · {metrica.titulo} · Últimos {diasHistorico} dias
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
              <th>Data</th>
              {ehVento ? (
                <>
                  <th>Direção predominante</th>
                  <th>Velocidade média</th>
                  <th>Rajada máxima</th>
                </>
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
            {linhas.map((linha) =>
              ehVento ? (
                <tr key={linha.data}>
                  <td>{linha.rotulo}</td>
                  <td>
                    <span className={styles.direcao}>
                      <span className={styles.setaDirecao} style={{ transform: `rotate(${linha.direcaoGraus}deg)` }}>
                        ↑
                      </span>
                      {linha.direcaoTexto} ({linha.direcaoGraus}°)
                    </span>
                  </td>
                  <td>{linha.velocidadeMedia?.toFixed(1)}</td>
                  <td>{linha.rajadaMaxima?.toFixed(1)}</td>
                  <td>km/h</td>
                </tr>
              ) : (
                <tr key={linha.data}>
                  <td>{linha.rotulo}</td>
                  <td>{linha.media?.toFixed(1)}</td>
                  <td>{linha.minimo?.toFixed(1)}</td>
                  <td>{linha.maximo?.toFixed(1)}</td>
                  <td>{metrica.unidade}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <p className={styles.legenda}>{linhas.length} dias no histórico — role pra ver mais.</p>
    </div>
  )
}

export default HistoricoDiarioTable
