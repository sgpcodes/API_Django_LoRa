import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Check } from 'lucide-react'
import { buscarPlanos } from '../services/planosService'
import styles from './GerenciamentoPlano.module.css'

// Plano atual fixo em "Standard" — ainda não há endpoint que devolva a
// assinatura ativa da conta logada (ver contas/models.py Assinatura, já
// existe no backend, só falta expor "minha assinatura" pro frontend).
const NOME_PLANO_ATUAL = 'Standard'

// Tela de Gerenciamento de Plano (2.2.2.5 do PDF): plano vigente, tabela
// comparativa entre Standard/Pro/Plus e botão de upgrade — leva ao
// Checkout com o plano escolhido.
function GerenciamentoPlano() {
  const navigate = useNavigate()
  const [planos, setPlanos] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    buscarPlanos()
      .then((dados) => setPlanos(dados.filter((plano) => plano.ativo).sort((a, b) => a.ordem - b.ordem)))
      .finally(() => setCarregando(false))
  }, [])

  function aoEscolherUpgrade(plano) {
    navigate('/app/checkout', { state: { plano } })
  }

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>
        <CreditCard size={20} />
        Gerenciamento de Plano
      </h1>

      <div className={styles.cartaoAtual}>
        <span className={styles.rotuloAtual}>Plano vigente</span>
        <span className={styles.nomeAtual}>{NOME_PLANO_ATUAL}</span>
        <span className={styles.semHistorico}>Conta gratuita — sem histórico de pagamento.</span>
      </div>

      {carregando ? (
        <p className={styles.carregando}>Carregando planos...</p>
      ) : (
        <div className={styles.tabelaComparativa}>
          {planos.map((plano) => {
            const ehAtual = plano.nome === NOME_PLANO_ATUAL
            return (
              <div key={plano.id} className={`${styles.coluna} ${ehAtual ? styles.colunaAtual : ''}`}>
                <span className={styles.nomePlano}>{plano.nome}</span>
                <span className={styles.precoPlano}>
                  {Number(plano.preco_mensal) === 0 ? 'Grátis' : `R$ ${Number(plano.preco_mensal).toFixed(0)}/mês`}
                </span>

                <ul className={styles.listaRecursos}>
                  <li className={styles.recurso}>
                    <Check size={14} className={styles.iconeOk} />
                    Até {plano.max_estacoes} estação(ões)
                  </li>
                  <li className={styles.recurso}>
                    <Check size={14} className={styles.iconeOk} />
                    Histórico de {plano.dias_historico} dias
                  </li>
                  {plano.funcionalidades_detalhe.map((funcionalidade) => (
                    <li key={funcionalidade.id} className={styles.recurso}>
                      <Check size={14} className={styles.iconeOk} />
                      {funcionalidade.nome}
                    </li>
                  ))}
                </ul>

                {ehAtual ? (
                  <span className={styles.seloAtual}>Plano atual</span>
                ) : (
                  <button type="button" className={styles.botaoUpgrade} onClick={() => aoEscolherUpgrade(plano)}>
                    Fazer upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default GerenciamentoPlano
