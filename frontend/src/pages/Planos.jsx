import { Check, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoLacop from '../assets/lacop.png'
import { obterTemaPorHorario } from '../services/climaService'
import styles from './Planos.module.css'

// Conteúdo estático por enquanto (RN21-RN23 do documento de regras de
// negócio) — os cards ainda não puxam de /api/planos/ nem levam a lugar
// nenhum: é uma vitrine, não o fluxo de assinatura (isso é próxima fase,
// depois que o que cada plano libera de verdade estiver mais definido).
const PLANOS = [
  {
    nome: 'Standard',
    resumo: 'Monitoramento básico, para quem está começando.',
    recursos: ['Dados em tempo real', 'Histórico de 30 dias', 'Alertas básicos (regras fixas)'],
  },
  {
    nome: 'Pro',
    resumo: 'Para quem já toma decisão operacional recorrente.',
    destaque: true,
    recursos: [
      'Tudo do Standard, mais:',
      'Previsão de chuva (24-48h)',
      'Índice de geada / estresse térmico',
      'Irrigação (evapotranspiração)',
      'Histórico de 12 meses',
      'Até 5 estações vinculadas',
    ],
  },
  {
    nome: 'Plus',
    resumo: 'Operações maiores, cooperativas e consultoria agronômica.',
    recursos: [
      'Tudo do Pro, mais:',
      'Previsão de médio prazo (7-15 dias)',
      'Modelos de Machine Learning',
      'Alertas personalizados via IA',
      'API própria de integração',
      'Estações ilimitadas',
      'Suporte prioritário',
    ],
  },
]

// Página pública (sem login) — porta de entrada do site. A única ação que
// de fato funciona aqui é o link de rodapé para quem já administra a
// plataforma; os planos de Usuário ainda não têm cadastro/assinatura
// pública ligados a eles.
function Planos() {
  return (
    <div className={styles.pagina} data-theme={obterTemaPorHorario()}>
      <header className={styles.cabecalho}>
        <img src={logoLacop} alt="LACOP UFF" className={styles.logo} />
        <h1 className={styles.titulo}>Monitoramento Agroclimático</h1>
        <p className={styles.subtitulo}>
          Dados climáticos das suas estações meteorológicas IoT, com alertas e recomendações
          para o manejo agrícola.
        </p>
      </header>

      <section className={styles.grade}>
        {PLANOS.map((plano) => (
          <article
            key={plano.nome}
            className={`${styles.cartao} ${plano.destaque ? styles.cartaoDestaque : ''}`}
          >
            {plano.destaque && <span className={styles.selo}>Mais procurado</span>}
            <h2 className={styles.nomePlano}>{plano.nome}</h2>
            <p className={styles.resumoPlano}>{plano.resumo}</p>
            <ul className={styles.listaRecursos}>
              {plano.recursos.map((recurso) => (
                <li key={recurso} className={styles.itemRecurso}>
                  <Check size={14} className={styles.iconeCheck} />
                  <span>{recurso}</span>
                </li>
              ))}
            </ul>
            <span className={styles.emBreve}>Assinatura em breve</span>
          </article>
        ))}
      </section>

      <footer className={styles.rodape}>
        <Link to="/cadastro" className={styles.linkCriarConta}>
          Criar conta
        </Link>
        <Link to="/login" className={styles.linkGerenciador}>
          <ShieldCheck size={14} />
          Entrar como gerenciador
        </Link>
      </footer>
    </div>
  )
}

export default Planos
