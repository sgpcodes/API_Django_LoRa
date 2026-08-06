import { Cpu, Table2, X } from 'lucide-react'
import styles from './ResumoSensoresTable.module.css'

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// Uma linha por sensor com os valores atuais e o resumo do período
// selecionado. Sensores offline ganham um botão pra sair da Visão Geral
// (ver VisaoGeral.jsx) — assim um ESP32 desligado de vez não fica poluindo
// a tela pra sempre; cada "linha" já vem com sua cor (mesma usada nos
// gráficos), pra identificar o sensor de relance.
function ResumoSensoresTable({ titulo, linhas, onRemover }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Table2 size={18} />
        {titulo}
      </h2>

      {linhas.length === 0 ? (
        <p className={styles.vazio}>Nenhum sensor encontrado ainda.</p>
      ) : (
        <div className={styles.tabelaWrapper}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>ID do sensor</th>
                <th>Temperatura atual</th>
                <th>Umidade atual</th>
                <th>Máxima</th>
                <th>Mínima</th>
                <th>Última atualização</th>
                <th>Status</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={linha.sensorId}>
                  <td>
                    <div className={styles.sensorCelula}>
                      <span className={styles.iconeChip} style={{ backgroundColor: linha.cor }}>
                        <Cpu size={14} />
                      </span>
                      <span className={styles.sensorNome}>{linha.sensorId}</span>
                    </div>
                  </td>
                  <td>{linha.temperaturaAtual}°C</td>
                  <td>{linha.umidadeAtual}%</td>
                  <td>{linha.temperaturaMaxima != null ? `${linha.temperaturaMaxima}°C` : '—'}</td>
                  <td>{linha.temperaturaMinima != null ? `${linha.temperaturaMinima}°C` : '—'}</td>
                  <td>{formatarDataHora(linha.ultimaAtualizacao)}</td>
                  <td>
                    <span
                      className={`${styles.statusPill} ${linha.online ? styles.statusOnline : styles.statusOffline}`}
                    >
                      <span className={styles.statusPonto} />
                      {linha.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className={styles.acao}>
                    {!linha.online && (
                      <button
                        type="button"
                        className={styles.botaoRemover}
                        onClick={() => onRemover(linha.sensorId)}
                        title="Remover da Visão Geral"
                        aria-label={`Remover ${linha.sensorId} da Visão Geral`}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ResumoSensoresTable
