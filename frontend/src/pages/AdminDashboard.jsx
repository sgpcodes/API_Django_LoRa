import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  Radio,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatusMessage from '../components/StatusMessage'
import DistribuicaoContasCard from '../components/DistribuicaoContasCard'
import { buscarEstacoes, buscarSensoresOrfaos } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import { buscarResumoDashboard } from '../services/manutencaoService'
import { calcularTendencia, calcularCrescimentoMensal } from '../services/estatisticasAdmin'
import styles from './AdminDashboard.module.css'

// Período fixo pra calcular as tendências (RN — sem seletor na tela,
// pra não duplicar o mesmo controle que já existe na Manutenção).
const DIAS_TENDENCIA = 30

// Rótulo amigável pra cada tipo real de evento do LogAuditoria (RN05) —
// se um dia aparecer uma ação nova que ainda não está aqui, cai no
// fallback (a própria string crua), nunca quebra a tela.
const CHAVES_ACAO = {
  'usuario.criado': 'acaoUsuarioCriado',
  'usuario.excluido': 'acaoUsuarioExcluido',
  'usuario.suspenso': 'acaoUsuarioSuspenso',
  'usuario.reativado': 'acaoUsuarioReativado',
  'plano.alterado': 'acaoPlanoAlterado',
  'estacao.criada': 'acaoEstacaoCriada',
  'estacao.usuarios_alterados': 'acaoEstacaoUsuariosAlterados',
  'estacao.excluida': 'acaoEstacaoExcluida',
  'leituras_orfas.excluidas': 'acaoLeiturasOrfasExcluidas',
  'manutencao.limpeza_operacional': 'acaoLimpezaOperacional',
  'manutencao.leituras_antigas_removidas': 'acaoLeiturasAntigasRemovidas',
}

function rotuloAcao(acao, t) {
  const chave = CHAVES_ACAO[acao]
  return chave ? t(`adminDashboard.${chave}`) : acao
}

function formatarDataHora(iso, locale) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

// Visão geral do Painel Administrativo — feedback rápido do sistema
// (contas, estações, crescimento, atividade e status das integrações).
// O que é mais técnico (banco por categoria, ambiente, zona de risco)
// fica só na tela de Manutenção, pra não duplicar a mesma informação
// em dois lugares. Só dado real: onde o sistema não tem como saber de
// verdade, a seção correspondente é honesta sobre isso.
function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'pt-BR'
  const [contas, setContas] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [info, setInfo] = useState(null)
  const [erroInfo, setErroInfo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    Promise.all([buscarEstacoes(), buscarSensoresOrfaos(), buscarContas()])
      .then(([dadosEstacoes, dadosOrfaos, dadosContas]) => {
        setEstacoes(dadosEstacoes)
        setOrfaos(dadosOrfaos)
        setContas(dadosContas)
        setErro(null)
      })
      .catch(() => setErro(t('adminDashboard.erroResumo')))
      .finally(() => setCarregando(false))

    buscarResumoDashboard()
      .then(setInfo)
      .catch(() => setErroInfo(t('adminDashboard.erroAtividade')))
  }, [])

  const totalOnline = estacoes.filter((estacao) => !estacao.esta_offline).length
  const totalOffline = estacoes.length - totalOnline
  const totalAtivas = contas.filter((conta) => conta.is_active).length
  const totalAlertas = totalOffline + orfaos.length

  const tendenciaContas = useMemo(() => calcularTendencia(contas, 'date_joined', DIAS_TENDENCIA), [contas])
  const tendenciaEstacoes = useMemo(() => calcularTendencia(estacoes, 'criado_em', DIAS_TENDENCIA), [estacoes])
  const crescimentoMensal = useMemo(
    () => calcularCrescimentoMensal(contas, estacoes, info?.leituras_por_mes),
    [contas, estacoes, info],
  )

  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerConteudo}>
        <div className={styles.bannerIcone}>
          <BarChart3 size={26} />
        </div>
        <div>
          <h1 className={styles.bannerTitulo}>{t('adminDashboard.bannerTitulo')}</h1>
          <p className={styles.bannerSubtitulo}>{t('adminDashboard.bannerSubtitulo')}</p>
        </div>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {banner}
        <StatusMessage texto={t('adminDashboard.carregando')} />
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
          <span className={styles.cartaoRotulo}>{t('adminDashboard.contasCadastradas')}</span>
          <ItemTendencia percentual={tendenciaContas} />
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}><UserCheck size={20} /></span>
          <span className={styles.cartaoValor}>{totalAtivas}</span>
          <span className={styles.cartaoRotulo}>{t('adminDashboard.contasAtivas')}</span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}><Radio size={20} /></span>
          <span className={styles.cartaoValor}>{estacoes.length}</span>
          <span className={styles.cartaoRotulo}>{t('adminDashboard.estacoesCadastradas')}</span>
          <ItemTendencia percentual={tendenciaEstacoes} />
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}><Wifi size={20} /></span>
          <span className={styles.cartaoValor}>{totalOnline}</span>
          <span className={styles.cartaoRotulo}>{t('adminDashboard.estacoesOnline')}</span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAmarela}`}><AlertTriangle size={20} /></span>
          <span className={styles.cartaoValor}>{totalAlertas}</span>
          <span className={styles.cartaoRotulo}>{t('adminDashboard.alertasAtivos')}</span>
        </div>
      </div>

      <div className={styles.linha3Colunas}>
        <DistribuicaoContasCard contas={contas} />

        <div className={`${styles.cartaoBloco} ${styles.cartaoBlocoLargo}`}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><TrendingUp size={16} /> {t('adminDashboard.crescimentoTitulo')}</h2>
            <span className={styles.blocoTag}>{t('adminDashboard.ultimos6Meses')}</span>
          </div>
          <p className={styles.blocoSubtitulo}>{t('adminDashboard.crescimentoSubtitulo')}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={crescimentoMensal} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="var(--color-grid)" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: 'var(--shadow-card)' }} />
              <Line type="monotone" dataKey="contas" name={t('adminDashboard.contasLinha')} stroke="#4a6fa5" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="estacoes" name={t('adminDashboard.estacoesLinha')} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
              {info?.leituras_por_mes && (
                <Line type="monotone" dataKey="leituras" name={t('adminDashboard.leiturasLinha')} stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.cartaoBloco}>
        <div className={styles.blocoCabecalho}>
          <h2 className={styles.blocoTitulo}><Clock size={16} /> {t('adminDashboard.atividadeTitulo')}</h2>
          <Link to="/app/adm/notificacoes" className={styles.linkVerTodas}>
            {t('adminDashboard.verTodas')} <ArrowRight size={13} />
          </Link>
        </div>
        <p className={styles.blocoSubtitulo}>{t('adminDashboard.atividadeSubtitulo')}</p>
        {erroInfo ? (
          <p className={styles.semDados}>{erroInfo}</p>
        ) : !info ? (
          <p className={styles.semDados}>{t('adminDashboard.carregandoCurto')}</p>
        ) : info.atividade_recente.length === 0 ? (
          <p className={styles.semDados}>{t('adminDashboard.nenhumEvento')}</p>
        ) : (
          <ul className={styles.listaAtividade}>
            {info.atividade_recente.slice(0, 6).map((evento) => (
              <li key={evento.id}>
                <span className={styles.itemAtividadeTexto}>
                  <strong>{rotuloAcao(evento.acao, t)}</strong>
                  <small>{evento.ator_username ?? t('adminDashboard.sistema')}</small>
                </span>
                <span className={styles.itemAtividadeData}>{formatarDataHora(evento.criado_em, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard
