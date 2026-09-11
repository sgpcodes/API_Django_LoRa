import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { X } from 'lucide-react'
import { variaveisCssDaCor } from '../services/aparenciaService'
import styles from './Modal.module.css'

// Janela grande (não a página inteira) por cima do conteúdo — usada pelo
// Dashboard pra "expandir" o gráfico/tabela e mostrar todas as métricas
// de uma vez. Fecha com o X, clicando fora, ou Esc.
//
// Renderizado via portal direto no <body>: alguns cards por trás usam
// backdrop-filter (o efeito de vidro fosco), que sem querer vira um
// "containing block" pra position:fixed — sem o portal, a janela ficaria
// presa dentro dos limites do card em vez de cobrir a tela toda.
//
// Só que o portal também escapa da <div> raiz do AppLayout/Painel
// Administrativo, que é onde `data-theme` e a cor de destaque (variáveis
// CSS customizadas) são aplicados — sem reaplicar os dois aqui, o modal
// nasceria sem nenhuma cor (tema/cor de destaque não chegam por herança
// de CSS quando o DOM não é mais descendente). useOutletContext()
// funciona mesmo assim porque contexto do React segue a árvore de
// componentes, não a árvore do DOM — portal não muda isso.
function Modal({ aberto, onFechar, titulo, icone: Icone, children }) {
  const { tema, corPrincipal } = useOutletContext() ?? {}

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(evento) {
      if (evento.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, onFechar])

  if (!aberto) return null

  return createPortal(
    <div className={styles.fundo} data-theme={tema} style={variaveisCssDaCor(corPrincipal)} onClick={onFechar}>
      <div className={styles.painel} onClick={(evento) => evento.stopPropagation()}>
        <div className={styles.cabecalho}>
          <h2 className={styles.titulo}>
            {Icone && <Icone size={18} />}
            {titulo}
          </h2>
          <button type="button" className={styles.botaoFechar} onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className={styles.corpo}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
