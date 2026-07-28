import styles from './PaginaEmBranco.module.css'

// Placeholder para páginas que já têm um lugar no menu, mas cujo conteúdo
// ainda vai ser definido (Dados do LoRa, Configurações).
function PaginaEmBranco({ icone: Icone, titulo }) {
  return (
    <div className={styles.container}>
      <div className={styles.iconeFundo}>
        <Icone size={28} />
      </div>
      <h1 className={styles.titulo}>{titulo}</h1>
      <p className={styles.texto}>Esta página ainda não tem conteúdo — em breve.</p>
    </div>
  )
}

export default PaginaEmBranco
