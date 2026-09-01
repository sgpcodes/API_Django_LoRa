import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, LogOut, ArrowRight } from 'lucide-react'
import { logout } from '../services/authService'
import { vincularEstacao } from '../services/estacaoService'
import styles from './VincularEstacao.module.css'

// Tela 3 da especificação de fluxo (conta Standard): primeiro acesso, sem
// estação ainda vinculada à conta. Só aparece uma vez — depois de vincular,
// os próximos logins caem direto no Dashboard (ver PortaDeEntradaApp).
function VincularEstacao({ onVinculado }) {
  const navigate = useNavigate()
  const [identificador, setIdentificador] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  async function aoEnviar(evento) {
    evento.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const registro = await vincularEstacao(identificador)
      onVinculado(registro)
    } catch (erroRequisicao) {
      setErro(erroRequisicao.message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.pagina}>
      <form className={styles.cartao} onSubmit={aoEnviar}>
        <div className={styles.iconeFundo}>
          <Radio size={28} />
        </div>
        <h1 className={styles.titulo}>Vincule sua estação</h1>
        <p className={styles.texto}>
          Informe o identificador (token) da estação meteorológica pra começar a acompanhar os dados.
        </p>

        <label className={styles.rotulo} htmlFor="identificador">
          Identificador da estação
        </label>
        <input
          id="identificador"
          type="text"
          placeholder="Ex.: ESP32_01"
          value={identificador}
          onChange={(evento) => setIdentificador(evento.target.value)}
          className={styles.campo}
          autoFocus
        />

        {erro && <p className={styles.erro}>{erro}</p>}

        <button type="submit" className={styles.botaoPrimario} disabled={carregando}>
          {carregando ? 'Vinculando...' : 'Vincular estação'}
          {!carregando && <ArrowRight size={18} />}
        </button>

        <button type="button" className={styles.botaoSair} onClick={aoSair}>
          <LogOut size={16} />
          Sair
        </button>
      </form>
    </div>
  )
}

export default VincularEstacao
