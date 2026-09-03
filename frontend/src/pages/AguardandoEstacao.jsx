import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, LogOut } from 'lucide-react'
import { logout } from '../services/authService'
import { buscarEstacoes } from '../services/estacaoService'
import styles from './AguardandoEstacao.module.css'

// Verifica de novo, sem a pessoa precisar recarregar a página, se o
// admin já atribuiu uma estação enquanto ela estava parada nesta tela.
const INTERVALO_VERIFICACAO_MS = 30_000

// Tela 3 da especificação de fluxo (conta Standard), agora atualizada: a
// pessoa não vincula mais a própria estação digitando um código — só o
// admin atribui uma estação a uma conta (ver ContasAdmin.jsx). Enquanto
// isso não acontece, esta tela fica esperando (e verifica sozinha de
// tempos em tempos).
function AguardandoEstacao({ onEstacaoAtribuida }) {
  const navigate = useNavigate()
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    async function verificar() {
      setVerificando(true)
      try {
        const estacoes = await buscarEstacoes()
        if (estacoes.length > 0) {
          onEstacaoAtribuida(estacoes[0])
        }
      } catch {
        // Falha de rede aqui não é grave — a próxima verificação periódica
        // tenta de novo sozinha, sem precisar avisar a pessoa.
      } finally {
        setVerificando(false)
      }
    }

    const intervalo = setInterval(verificar, INTERVALO_VERIFICACAO_MS)
    return () => clearInterval(intervalo)
  }, [onEstacaoAtribuida])

  function aoSair() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cartao}>
        <div className={styles.iconeFundo}>
          <Radio size={28} />
        </div>
        <h1 className={styles.titulo}>Aguardando sua estação</h1>
        <p className={styles.texto}>
          Sua conta ainda não tem uma estação meteorológica vinculada. Assim que o administrador
          atribuir uma estação a você, esta página libera o acesso automaticamente.
        </p>
        {verificando && <p className={styles.dica}>Verificando...</p>}

        <button type="button" className={styles.botaoSair} onClick={aoSair}>
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  )
}

export default AguardandoEstacao
