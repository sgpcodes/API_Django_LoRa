import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import styles from './DistribuicaoContasCard.module.css'

const CORES_PLANO = { Standard: '#4a6fa5', Pro: '#8b5cf6', Plus: '#f59e0b' }

// Donut de contas por plano (Standard/Pro/Plus) — usado tanto no
// Dashboard quanto na Manutenção do Painel Administrativo, sempre a
// partir da mesma lista de contas que a página já buscou (nenhuma
// chamada própria aqui).
function DistribuicaoContasCard({ contas }) {
  const contadorPlanos = { Standard: 0, Pro: 0, Plus: 0 }
  contas.forEach((conta) => {
    if (conta.plano_atual && contadorPlanos[conta.plano_atual] != null) contadorPlanos[conta.plano_atual] += 1
  })
  const dadosDonut = Object.entries(contadorPlanos)
    .filter(([, quantidade]) => quantidade > 0)
    .map(([plano, quantidade]) => ({ plano, quantidade, cor: CORES_PLANO[plano] }))

  return (
    <div className={styles.cartaoBloco}>
      <div className={styles.blocoCabecalho}>
        <h2 className={styles.blocoTitulo}><Users size={16} /> Distribuição das contas</h2>
        <Link to="/app/adm/contas" className={styles.linkVerTodas}>Ver todas <ArrowRight size={13} /></Link>
      </div>
      <p className={styles.blocoSubtitulo}>Planos ativos na plataforma</p>
      {contas.length === 0 ? (
        <p className={styles.semDados}>Nenhuma conta cadastrada ainda.</p>
      ) : (
        <div className={styles.donutLinha}>
          <div className={styles.donutContainer}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={dadosDonut} dataKey="quantidade" innerRadius={44} outerRadius={70} startAngle={90} endAngle={-270}>
                  {dadosDonut.map((fatia) => (
                    <Cell key={fatia.plano} fill={fatia.cor} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.donutCentro}>
              <span className={styles.donutTotal}>{contas.length}</span>
              <span className={styles.donutRotulo}>contas</span>
            </div>
          </div>
          <ul className={styles.legendaDonut}>
            {Object.entries(contadorPlanos).map(([plano, quantidade]) => (
              <li key={plano}>
                <span className={styles.pontoLegenda} style={{ backgroundColor: CORES_PLANO[plano] }} />
                <span className={styles.legendaNome}>{plano}</span>
                <span className={styles.legendaValor}>{quantidade}</span>
                <span className={styles.legendaPercentual}>
                  {contas.length > 0 ? Math.round((quantidade / contas.length) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DistribuicaoContasCard
