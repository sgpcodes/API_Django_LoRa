import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShoppingCart, CreditCard, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import styles from './Checkout.module.css'

// Tela de Checkout (2.2.2.6 do PDF). O gateway de pagamento de verdade
// (ex.: Stripe) ainda não está integrado — este formulário só simula o
// fluxo (processando → aprovado), pra validar a navegação e os estados de
// tela enquanto o gateway definitivo não é escolhido.
function Checkout() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const plano = state?.plano

  const [numeroCartao, setNumeroCartao] = useState('')
  const [validade, setValidade] = useState('')
  const [cvv, setCvv] = useState('')
  const [estado, setEstado] = useState('formulario') // formulario | processando | aprovado | recusado

  if (!plano) {
    return (
      <div className={styles.pagina}>
        <p className={styles.semPlano}>
          Nenhum plano selecionado.{' '}
          <button type="button" className={styles.linkVoltar} onClick={() => navigate('/app/plano')}>
            Escolher um plano
          </button>
        </p>
      </div>
    )
  }

  async function aoConfirmar(evento) {
    evento.preventDefault()
    setEstado('processando')
    // Simulação: sem gateway real integrado ainda.
    await new Promise((resolver) => setTimeout(resolver, 1500))
    setEstado('aprovado')
  }

  if (estado === 'aprovado') {
    return (
      <div className={styles.pagina}>
        <div className={styles.cartaoEstado}>
          <CheckCircle2 size={40} className={styles.iconeAprovado} />
          <h1 className={styles.tituloEstado}>Pagamento aprovado</h1>
          <p className={styles.textoEstado}>
            Seu plano foi atualizado para <strong>{plano.nome}</strong>. O recibo foi enviado por e-mail.
          </p>
          <button type="button" className={styles.botaoPrimario} onClick={() => navigate('/app')}>
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (estado === 'recusado') {
    return (
      <div className={styles.pagina}>
        <div className={styles.cartaoEstado}>
          <XCircle size={40} className={styles.iconeRecusado} />
          <h1 className={styles.tituloEstado}>Pagamento recusado</h1>
          <p className={styles.textoEstado}>Seu plano atual foi mantido. Tente novamente com outro cartão.</p>
          <button type="button" className={styles.botaoPrimario} onClick={() => setEstado('formulario')}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <button type="button" className={styles.botaoVoltar} onClick={() => navigate('/app/plano')}>
        <ArrowLeft size={16} />
        Voltar
      </button>

      <h1 className={styles.titulo}>
        <ShoppingCart size={20} />
        Checkout
      </h1>

      <div className={styles.grade}>
        <div className={styles.resumo}>
          <span className={styles.rotuloResumo}>Plano escolhido</span>
          <span className={styles.nomeResumo}>{plano.nome}</span>
          <span className={styles.valorResumo}>
            R$ {Number(plano.preco_mensal).toFixed(2)}
            <span className={styles.periodicidade}>/mês</span>
          </span>
        </div>

        <form className={styles.formulario} onSubmit={aoConfirmar}>
          <h2 className={styles.tituloFormulario}>
            <CreditCard size={16} />
            Dados de pagamento
          </h2>

          <label className={styles.rotulo} htmlFor="numeroCartao">
            Número do cartão
          </label>
          <input
            id="numeroCartao"
            className={styles.campo}
            placeholder="0000 0000 0000 0000"
            value={numeroCartao}
            onChange={(evento) => setNumeroCartao(evento.target.value)}
            required
          />

          <div className={styles.linha2Colunas}>
            <div>
              <label className={styles.rotulo} htmlFor="validade">
                Validade
              </label>
              <input
                id="validade"
                className={styles.campo}
                placeholder="MM/AA"
                value={validade}
                onChange={(evento) => setValidade(evento.target.value)}
                required
              />
            </div>
            <div>
              <label className={styles.rotulo} htmlFor="cvv">
                CVV
              </label>
              <input
                id="cvv"
                className={styles.campo}
                placeholder="123"
                value={cvv}
                onChange={(evento) => setCvv(evento.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.botaoPrimario} disabled={estado === 'processando'}>
            {estado === 'processando' ? 'Processando pagamento...' : 'Confirmar pagamento'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Checkout
