import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  Radio,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatusMessage from '../components/StatusMessage'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import { buscarInfoSistema } from '../services/manutencaoService'
import styles from './AdminDashboard.module.css'

const CORES_PLANO = { Standard: '#4a6fa5', Pro: '#8b5cf6', Plus: '#f59e0b' }

const OPCOES_PERIODO_TENDENCIA = [
  { valor: 7, rotulo: 'Últimos 7 dias' },
  { valor: 30, rotulo: 'Últimos 30 dias' },
  { valor: 90, rotulo: 'Últimos 90 dias' },
]

// Rótulo amigável pra cada tipo real de evento do LogAuditoria (RN05) —
// se um dia aparecer uma ação nova que ainda não está aqui, cai no
// fallback (a própria string crua), nunca quebra a tela.
const ROTULOS_ACAO = {
  'usuario.criado': 'Nova conta cadastrada',
  'usuario.excluido': 'Conta excluída',
  'usuario.suspenso': 'Conta desativada',
  'usuario.reativado': 'Conta reativada',
  'plano.alterado': 'Plano atualizado',
  'estacao.criada': 'Nova estação cadastrada',
  'estacao.usuarios_alterados': 'Estação atribuída',
  'estacao.excluida': 'Estação removida',
  'leituras_orfas.excluidas': 'Leituras órfãs removidas',
  'manutencao.limpeza_operacional': 'Limpeza operacional executada',
}

function rotuloAcao(acao) {
  return ROTULOS_ACAO[acao] ?? acao
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// % de crescimento no período: quantos itens novos entraram nos últimos
// `dias` contra quantos já existiam antes disso. Sem base anterior (tudo
// foi criado dentro do próprio período, ou não existe nada) não dá pra
// calcular uma variação de verdade — devolve null em vez de inventar um
// número, e o card mostra só o total, sem seta.
function calcularTendencia(itens, campoData, dias) {
  const limite = Date.now() - dias * 24 * 60 * 60 * 1000
  const novos = itens.filter((item) => new Date(item[campoData]).getTime() >= limite).length
  const baseAnterior = itens.length - novos
  if (baseAnterior <= 0) return null
  return Math.round((novos / baseAnterior) * 100)
}

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Novas contas/estações por mês, últimos 6 meses (incluindo o atual) —
// contagem de verdade a partir de date_joined/criado_em, sem simular
// nenhum ponto.
function calcularCrescimentoMensal(contas, estacoes) {
  const agora = new Date()
  const meses = []
  for (let i = 5; i >= 0; i -= 1) {
    const referencia = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    meses.push({ ano: referencia.getFullYear(), mes: referencia.getMonth(), rotulo: NOMES_MES[referencia.getMonth()] })
  }

  function contarNoMes(itens, campoData, ano, mes) {
    return itens.filter((item) => {
      const data = new Date(item[campoData])
      return data.getFullYear() === ano && data.getMonth() === mes
    }).length
  }

  return meses.map(({ ano, mes, rotulo }) => ({
    rotulo,
    contas: contarNoMes(contas, 'date_joined', ano, mes),
    estacoes: contarNoMes(estacoes, 'criado_em', ano, mes),
  }))
}

function ItemTendencia({ percentual }) {
  if (percentual == null) return null
  const Icone = percentual >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`${styles.tendencia} ${percentual >= 0 ? styles.tendenciaAlta : styles.tendenciaBaixa}`}>
      <Icone size={12} />
      {Math.abs(percentual)}%
    </span>
  )
}

// Visão geral do Painel Administrativo — só com dado real. Onde o
// sistema não tem como saber de verdade (ex.: disponibilidade histórica,
// serviços internos separados que não existem nessa arquitetura), a
// seção correspondente é honesta sobre isso em vez de mostrar um número
// inventado.
function AdminDashboard() {
  const [contas, setContas] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [info, setInfo] = useState(null)
  const [erroInfo, setErroInfo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [diasTendencia, setDiasTendencia] = useState(30)

  useEffect(() => {
    Promise.all([buscarEstacoes(), buscarSensoresOrfaos(), buscarContas()])
      .then(([dadosEstacoes, dadosOrfaos, dadosContas]) => {
        setEstacoes(dadosEstacoes)
        setOrfaos(dadosOrfaos)
        setContas(dadosContas)
        setErro(null)
      })
      .catch(() => setErro('Não foi possível carregar o resumo agora.'))
      .finally(() => setCarregando(false))

    buscarInfoSistema()
      .then(setInfo)
      .catch(() => setErroInfo('Não foi possível carregar banco de dados, atividade recente e status do sistema agora.'))
  }, [])

  const totalOnline = estacoes.filter((estacao) => !estacao.esta_offline).length
  const totalOffline = estacoes.length - totalOnline
  const totalAtivas = contas.filter((conta) => conta.is_active).length
  const totalAlertas = totalOffline + orfaos.length

  const contadorPlanos = { Standard: 0, Pro: 0, Plus: 0 }
  contas.forEach((conta) => {
    if (conta.plano_atual && contadorPlanos[conta.plano_atual] != null) contadorPlanos[conta.plano_atual] += 1
  })
  const dadosDonut = Object.entries(contadorPlanos)
    .filter(([, quantidade]) => quantidade > 0)
    .map(([plano, quantidade]) => ({ plano, quantidade, cor: CORES_PLANO[plano] }))

  const tendenciaContas = useMemo(() => calcularTendencia(contas, 'date_joined', diasTendencia), [contas, diasTendencia])
  const tendenciaEstacoes = useMemo(
    () => calcularTendencia(estacoes, 'criado_em', diasTendencia),
    [estacoes, diasTendencia],
  )
  const crescimentoMensal = useMemo(() => calcularCrescimentoMensal(contas, estacoes), [contas, estacoes])

  const bancoOnline = info != null
  const inmetOnline = info?.integracoes?.inmet?.online ?? false
  const ibgeOnline = info?.integracoes?.ibge?.online ?? false
  const sistemaOperacional = bancoOnline && inmetOnline && ibgeOnline

  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerConteudo}>
        <div className={styles.bannerIcone}>
          <BarChart3 size={26} />
        </div>
        <div>
          <h1 className={styles.bannerTitulo}>Visão geral do sistema</h1>
          <p className={styles.bannerSubtitulo}>Acompanhe o desempenho da plataforma, contas e estações.</p>
        </div>
      </div>
      <div className={styles.seletorTendencia}>
        <Calendar size={14} />
        <select value={diasTendencia} onChange={(evento) => setDiasTendencia(Number(evento.target.value))}>
          {OPCOES_PERIODO_TENDENCIA.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
          ))}
        </select>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {banner}
        <StatusMessage texto="Carregando visão geral..." />
      </div>
    )
  }

  if (erro) {
    return (
      <div className={styles.pagina}>
        {banner}
        <StatusMessage texto={erro} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      {banner}

      <div className={styles.grade}>
        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}><Users size={20} /></span>
          <span className={styles.cartaoValor}>{contas.length}</span>
          <span className={styles.cartaoRotulo}>Contas cadastradas</span>
          <ItemTendencia percentual={tendenciaContas} />
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}><UserCheck size={20} /></span>
          <span className={styles.cartaoValor}>{totalAtivas}</span>
          <span className={styles.cartaoRotulo}>Contas ativas</span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}><Radio size={20} /></span>
          <span className={styles.cartaoValor}>{estacoes.length}</span>
          <span className={styles.cartaoRotulo}>Estações cadastradas</span>
          <ItemTendencia percentual={tendenciaEstacoes} />
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}><Wifi size={20} /></span>
          <span className={styles.cartaoValor}>{totalOnline}</span>
          <span className={styles.cartaoRotulo}>Estações online</span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAmarela}`}><AlertTriangle size={20} /></span>
          <span className={styles.cartaoValor}>{totalAlertas}</span>
          <span className={styles.cartaoRotulo}>Alertas ativos</span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corRoxa}`}><HardDrive size={20} /></span>
          <span className={styles.cartaoValor}>{info?.banco?.tamanho_legivel ?? '—'}</span>
          <span className={styles.cartaoRotulo}>Tamanho do banco de dados</span>
        </div>
      </div>

      <div className={styles.linha3Colunas}>
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

        <div className={`${styles.cartaoBloco} ${styles.cartaoBlocoLargo}`}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><TrendingUp size={16} /> Crescimento da plataforma</h2>
            <span className={styles.blocoTag}>Últimos 6 meses</span>
          </div>
          <p className={styles.blocoSubtitulo}>Novas contas e estações cadastradas por mês</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={crescimentoMensal} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }} />
              <Line type="monotone" dataKey="contas" name="Contas" stroke="#4a6fa5" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="estacoes" name="Estações" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.cartaoBloco}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><Activity size={16} /> Uso da plataforma</h2>
            <Link to="/app/adm/manutencao" className={styles.linkVerTodas}>Ver detalhes <ArrowRight size={13} /></Link>
          </div>
          <p className={styles.blocoSubtitulo}>Armazenamento e processamento de dados</p>
          {erroInfo ? (
            <p className={styles.semDados}>{erroInfo}</p>
          ) : (
            <ul className={styles.listaUso}>
              <li>
                <Database size={14} />
                <span>Banco de dados</span>
                <strong>{info?.banco?.tamanho_legivel ?? '—'}</strong>
              </li>
              <li>
                <Activity size={14} />
                <span>Leituras processadas</span>
                <strong>{info?.contagens?.leituras ?? '—'}</strong>
              </li>
              <li>
                <Clock size={14} />
                <span>Eventos de auditoria</span>
                <strong>{info?.contagens?.log_auditoria ?? '—'}</strong>
              </li>
            </ul>
          )}
        </div>
      </div>

      <div className={styles.linha2Colunas}>
        <div className={styles.cartaoBloco}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><Clock size={16} /> Atividade recente</h2>
            <Link to="/app/adm/notificacoes" className={styles.linkVerTodas}>Ver todas <ArrowRight size={13} /></Link>
          </div>
          <p className={styles.blocoSubtitulo}>Últimas ações no sistema</p>
          {erroInfo ? (
            <p className={styles.semDados}>{erroInfo}</p>
          ) : !info ? (
            <p className={styles.semDados}>Carregando...</p>
          ) : info.atividade_recente.length === 0 ? (
            <p className={styles.semDados}>Nenhum evento registrado ainda.</p>
          ) : (
            <ul className={styles.listaAtividade}>
              {info.atividade_recente.slice(0, 6).map((evento) => (
                <li key={evento.id}>
                  <span className={styles.itemAtividadeTexto}>
                    <strong>{rotuloAcao(evento.acao)}</strong>
                    <small>{evento.ator_username ?? 'sistema'}</small>
                  </span>
                  <span className={styles.itemAtividadeData}>{formatarDataHora(evento.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.cartaoBloco}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><Activity size={16} /> Status do sistema</h2>
            {!erroInfo && (
              <span className={sistemaOperacional ? styles.pillOnline : styles.pillOffline}>
                {sistemaOperacional ? 'Sistema operacional' : 'Atenção necessária'}
              </span>
            )}
          </div>
          <p className={styles.blocoSubtitulo}>Conectividade com o banco e as integrações externas</p>
          {erroInfo ? (
            <p className={styles.semDados}>{erroInfo}</p>
          ) : (
            <ul className={styles.listaStatus}>
              {[
                { nome: 'Banco de dados', online: bancoOnline },
                { nome: 'INMET (clima)', online: inmetOnline },
                { nome: 'IBGE (municípios)', online: ibgeOnline },
              ].map((servico) => (
                <li key={servico.nome}>
                  {servico.online ? <CheckCircle2 size={15} className={styles.iconeOnline} /> : <XCircle size={15} className={styles.iconeOffline} />}
                  <span>{servico.nome}</span>
                  <span className={servico.online ? styles.pillOnline : styles.pillOffline}>
                    {servico.online ? 'Online' : 'Fora do ar'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
