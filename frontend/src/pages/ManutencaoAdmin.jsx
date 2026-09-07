import { useEffect, useState } from 'react'
import { AlertTriangle, Database, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarResumoLimpeza, executarLimpeza } from '../services/manutencaoService'
import styles from './ManutencaoAdmin.module.css'

const FRASE_CONFIRMACAO = 'APAGAR TUDO'

// Tela "Manutenção" do Painel Administrativo — zona de risco: apaga
// todas as contas (exceto sua conta superusuário) e todo o histórico de
// clima já recebido, deixando o sistema pronto pra receber contas e
// dados novos. Planos/Funcionalidades/Token de credenciamento não são
// tocados (senão ninguém mais conseguiria se cadastrar depois).
//
// Duas travas antes de executar: precisa digitar a frase exata E
// confirmar num segundo aviso (window.confirm) — bem mais fricção que
// qualquer outro botão do painel, de propósito, porque isso aqui não
// tem desfazer.
function ManutencaoAdmin() {
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [fraseDigitada, setFraseDigitada] = useState('')
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function carregar() {
    setCarregando(true)
    try {
      const dados = await buscarResumoLimpeza()
      setResumo(dados)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar a prévia agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const nadaParaApagar =
    resumo && resumo.leituras === 0 && resumo.estacoes === 0 && resumo.contas === 0 && resumo.solicitacoes_rssi === 0

  async function aoConfirmarLimpeza() {
    if (
      !window.confirm(
        `Isso vai apagar ${resumo.contas} conta(s), ${resumo.estacoes} estação(ões) e ${resumo.leituras} leitura(s) PRA SEMPRE. Não tem como desfazer. Confirma?`,
      )
    ) {
      return
    }

    setExecutando(true)
    setErro(null)
    try {
      const dados = await executarLimpeza()
      setResultado(dados)
      setFraseDigitada('')
      await carregar()
    } catch {
      setErro('Não foi possível concluir a limpeza. Tente de novo.')
    } finally {
      setExecutando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando..." />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>
          <Database size={20} />
          Manutenção
        </h1>
        <p className={styles.subtitulo}>Zona de risco — apaga dados operacionais pra zerar o sistema.</p>
      </div>

      {erro && <p className={styles.erroCarga}>{erro}</p>}

      {resumo && (
        <div className={styles.cartaoPerigo}>
          <div className={styles.cabecalhoPerigo}>
            <ShieldAlert size={22} />
            <div>
              <h2 className={styles.tituloPerigo}>Apagar contas e dados de clima</h2>
              <p className={styles.textoPerigo}>
                Apaga todas as contas cadastradas (menos a sua, de superusuário), todas as estações e todo o
                histórico de leituras já recebido. <strong>Não apaga</strong> os planos, as funcionalidades nem o
                token de credenciamento — o sistema continua pronto pra receber cadastros novos depois.
                <strong> Essa ação não pode ser desfeita.</strong>
              </p>
            </div>
          </div>

          <div className={styles.grade}>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.contas}</span>
              <span className={styles.itemRotulo}>conta(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.estacoes}</span>
              <span className={styles.itemRotulo}>estação(ões)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.leituras}</span>
              <span className={styles.itemRotulo}>leitura(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.solicitacoes_rssi}</span>
              <span className={styles.itemRotulo}>solicitação(ões) RSSI</span>
            </div>
          </div>

          <p className={styles.preservados}>
            Preservado(s): conta(s) superusuário {resumo.superusuarios_preservados.join(', ')}, planos,
            funcionalidades e token de credenciamento.
          </p>

          {nadaParaApagar ? (
            <p className={styles.avisoVazio}>
              <AlertTriangle size={15} />
              Não há nada pra apagar agora — já está tudo zerado.
            </p>
          ) : (
            <div className={styles.blocoConfirmacao}>
              <label className={styles.rotuloConfirmacao} htmlFor="frase-confirmacao">
                Pra habilitar o botão, digite <strong>{FRASE_CONFIRMACAO}</strong> abaixo:
              </label>
              <input
                id="frase-confirmacao"
                className={styles.inputConfirmacao}
                value={fraseDigitada}
                onChange={(e) => setFraseDigitada(e.target.value)}
                placeholder={FRASE_CONFIRMACAO}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.botaoApagar}
                disabled={fraseDigitada !== FRASE_CONFIRMACAO || executando}
                onClick={aoConfirmarLimpeza}
              >
                <Trash2 size={16} />
                {executando ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className={styles.cartaoResultado}>
          <RefreshCw size={16} />
          Pronto: {resultado.contas} conta(s), {resultado.estacoes} estação(ões) e {resultado.leituras} leitura(s)
          apagadas.
        </div>
      )}
    </div>
  )
}

export default ManutencaoAdmin
