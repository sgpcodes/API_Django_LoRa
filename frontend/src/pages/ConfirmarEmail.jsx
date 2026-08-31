import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import fundoAutenticacao from '../assets/fundo-autenticacao.png'
import logoLacop from '../assets/lacop.png'
import { confirmarEmail } from '../services/authService'
// Reaproveita o mesmo visual do Login (painel com a imagem + cartão) —
// ver Login.module.css, não faz sentido duplicar essa moldura aqui.
import styles from './Login.module.css'

// Página que o link do e-mail de confirmação abre
// (/confirmar-email/:uidb64/:token). Só três estados possíveis:
// carregando -> sucesso ou erro.
function ConfirmarEmail() {
  const { uidb64, token } = useParams()
  const [estado, setEstado] = useState('carregando') // 'carregando' | 'sucesso' | 'erro'

  useEffect(() => {
    confirmarEmail(uidb64, token)
      .then(() => setEstado('sucesso'))
      .catch(() => setEstado('erro'))
  }, [uidb64, token])

  return (
    <div className={styles.fundo} data-theme="dia">
      <div className={styles.pagina}>
        <aside
          className={styles.painelMarketing}
          style={{ backgroundImage: `url(${fundoAutenticacao})` }}
          aria-hidden="true"
        />
        <main className={styles.painelFormulario}>
          <div className={styles.cartao}>
            <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />

            {estado === 'carregando' && (
              <>
                <h1 className={styles.titulo}>Confirmando...</h1>
                <p className={styles.subtitulo}>Só um instante.</p>
              </>
            )}

            {estado === 'sucesso' && (
              <>
                <CheckCircle2 size={40} color="#22c55e" style={{ alignSelf: 'center' }} />
                <h1 className={styles.titulo}>E-mail confirmado!</h1>
                <p className={styles.subtitulo}>Sua conta já está com o e-mail verificado.</p>
                <Link to="/app" className={styles.botao} style={{ textDecoration: 'none' }}>
                  Ir para o dashboard
                </Link>
              </>
            )}

            {estado === 'erro' && (
              <>
                <XCircle size={40} color="#ef4444" style={{ alignSelf: 'center' }} />
                <h1 className={styles.titulo}>Link inválido ou expirado</h1>
                <p className={styles.subtitulo}>
                  Faça login e peça um novo e-mail de confirmação na sua conta.
                </p>
                <Link to="/login" className={styles.botao} style={{ textDecoration: 'none' }}>
                  Ir para o login
                </Link>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default ConfirmarEmail
