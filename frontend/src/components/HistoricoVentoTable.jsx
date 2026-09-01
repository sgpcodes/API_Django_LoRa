import { useState } from 'react'
import { Wind, Download, FileText, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import styles from './HistoricoVentoTable.module.css'

const LINHAS_POR_PAGINA = 6

function formatarData(dataHoraISO) {
  const data = new Date(dataHoraISO)
  return data.toLocaleDateString('pt-BR')
}

function formatarHora(dataHoraISO) {
  const data = new Date(dataHoraISO)
  return `${String(data.getHours()).padStart(2, '0')}:00`
}

// Tabela paginada com o histórico de vento (data, hora, direção,
// velocidade média, rajada máxima) — igual à imagem de referência, com
// atalhos de exportação (só a interface por enquanto; a exportação de
// verdade entra quando a fonte de dados definitiva estiver decidida).
function HistoricoVentoTable({ registros, diasHistorico }) {
  const [pagina, setPagina] = useState(1)
  const [menuExportarAberto, setMenuExportarAberto] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(registros.length / LINHAS_POR_PAGINA))
  const inicio = (pagina - 1) * LINHAS_POR_PAGINA
  const visiveis = registros.slice(inicio, inicio + LINHAS_POR_PAGINA)

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          <Wind size={18} />
          Histórico de vento · Últimos {diasHistorico} dias
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

      <div className={styles.tabelaWrapper}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Direção</th>
              <th>Velocidade média</th>
              <th>Rajada máxima</th>
              <th>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((registro) => (
              <tr key={registro.dataHora}>
                <td>{formatarData(registro.dataHora)}</td>
                <td>{formatarHora(registro.dataHora)}</td>
                <td>
                  <span className={styles.direcao}>
                    <span
                      className={styles.setaDirecao}
                      style={{ transform: `rotate(${registro.direcaoGraus}deg)` }}
                    >
                      ↑
                    </span>
                    {registro.direcaoTexto} ({registro.direcaoGraus}°)
                  </span>
                </td>
                <td>{registro.velocidade?.toFixed(1)}</td>
                <td>{registro.rajada?.toFixed(1)}</td>
                <td>km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.rodape}>
        <span className={styles.legendaPaginacao}>
          Mostrando {registros.length === 0 ? 0 : inicio + 1} a {Math.min(inicio + LINHAS_POR_PAGINA, registros.length)} de{' '}
          {registros.length} registros
        </span>
        <div className={styles.paginacao}>
          <button
            type="button"
            className={styles.botaoPagina}
            onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
            disabled={pagina === 1}
          >
            <ChevronLeft size={14} />
          </button>
          <span className={styles.paginaAtual}>{pagina}</span>
          <button
            type="button"
            className={styles.botaoPagina}
            onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
            disabled={pagina === totalPaginas}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default HistoricoVentoTable
