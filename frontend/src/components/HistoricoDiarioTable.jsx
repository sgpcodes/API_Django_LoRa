import { Download, FileText, ChevronDown, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { METRICAS_CLIMA, OPCOES_PERIODO } from '../services/metricasClima'
import Modal from './Modal'
import styles from './HistoricoDiarioTable.module.css'

// Uma tabela só, reaproveitada tanto pela visão normal (uma métrica por
// vez) quanto pelo modal "ver todas as tabelas".
//
// "Hoje"/"Ontem": uma linha por HORA, valor bruto (sem média — RN: só há
// média com mais de um dia selecionado). "7/30 dias": uma linha por DIA,
// com média/mínima/máxima.
function TabelaMetrica({ metrica, linhas, ehPorHora }) {
  const Icone = metrica.icone
  const ehVento = metrica.chave === 'vento'

  return (
    <div>
      <h3 className={styles.tituloTabela}>
        <Icone size={15} />
        {metrica.titulo}
      </h3>
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

// Tabela de histórico do Dashboard. Navega entre métricas (temperatura/
// umidade/pressão/vento) de forma independente do gráfico ao lado — só o
// período (Hoje/Ontem/7/30 dias) é compartilhado, vem do seletor lá em
// cima do Dashboard. Botão "expandir" abre uma janela grande com as 4
// tabelas de uma vez.
function HistoricoDiarioTable({ tabela, indice, onMudarIndice, periodo, granularidade }) {
  const [menuExportarAberto, setMenuExportarAberto] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const metrica = METRICAS_CLIMA[indice]
  const ehPorHora = granularidade === 'hora'
  const rotuloPeriodo = OPCOES_PERIODO.find((opcao) => opcao.valor === periodo)?.rotulo

  function irPara(delta) {
    onMudarIndice((METRICAS_CLIMA.length + indice + delta) % METRICAS_CLIMA.length)
  }

  return (
    <div className={styles.container}>
      <div className={styles.cabecalho}>
        <h2 className={styles.titulo}>
          Histórico {ehPorHora ? 'por hora' : 'diário'} · {rotuloPeriodo}
        </h2>
        <div className={styles.acoes}>
          <div className={styles.navegacao}>
            <button
              type="button"
              className={styles.botaoSeta}
              onClick={() => setModalAberto(true)}
              aria-label="Expandir — ver todas as tabelas"
              title="Ver todas as tabelas"
            >
              <Maximize2 size={15} />
            </button>
            <button type="button" className={styles.botaoSeta} onClick={() => irPara(-1)} aria-label="Métrica anterior">
              <ChevronLeft size={16} />
            </button>
            <div className={styles.pontos}>
              {METRICAS_CLIMA.map((item, i) => (
                <span key={item.chave} className={`${styles.ponto} ${i === indice ? styles.pontoAtivo : ''}`} />
              ))}
            </div>
            <button type="button" className={styles.botaoSeta} onClick={() => irPara(1)} aria-label="Próxima métrica">
              <ChevronRight size={16} />
            </button>
          </div>

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

      <TabelaMetrica metrica={metrica} linhas={tabela[metrica.chave] ?? []} ehPorHora={ehPorHora} />

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo={`Todas as tabelas · ${rotuloPeriodo}`} icone={Maximize2}>
        <div className={styles.grademodal}>
          {METRICAS_CLIMA.map((item) => (
            <TabelaMetrica key={item.chave} metrica={item} linhas={tabela[item.chave] ?? []} ehPorHora={ehPorHora} />
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default HistoricoDiarioTable
