import styles from './PaginaEmBranco.module.css'

// Placeholder para páginas que já têm um lugar no menu, mas cujo conteúdo
// ainda vai ser definido (Dados do LoRa, Perfil) — ou pra um aviso
// pontual com ícone (ex.: Dashboard sem estação atribuída), via
// `mensagem` customizada em vez do texto genérico "em breve".
function PaginaEmBranco({ icone: Icone, titulo, mensagem }) {
  return (
    <div className={styles.container}>
      <div className={styles.iconeFundo}>
        <Icone size={28} />
      </div>
      <h1 className={styles.titulo}>{titulo}</h1>
      <p className={styles.texto}>{mensagem ?? 'Esta página ainda não tem conteúdo — em breve.'}</p>
    </div>
  )
}

export default PaginaEmBranco
