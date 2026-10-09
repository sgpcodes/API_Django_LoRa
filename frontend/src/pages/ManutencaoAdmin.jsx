import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Cpu,
  Database,
  Globe,
  HardDrive,
  RefreshCw,
  Settings,
  ShieldAlert,
  Trash2,
  TrendingDown,
  TrendingUp,
  Radio,
  Users,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import StatusMessage from '../components/StatusMessage'
import { IndicadorAtualizando } from '../components/Spinner'
import {
  buscarInfoSistema,
  buscarResumoLimpeza,
  executarLimpeza,
  buscarResumoLimpezaLeiturasAntigas,
  executarLimpezaLeiturasAntigas,
} from '../services/manutencaoService'
import styles from './ManutencaoAdmin.module.css'

const FRASE_CONFIRMACAO = 'APAGAR TUDO'
const FRASE_CONFIRMACAO_ANTIGAS = 'APAGAR LEITURAS ANTIGAS'

const ROTULOS_CATEGORIA_BANCO = {
  dados_meteorologicos: 'Dados meteorológicos',
  contas_e_estacoes: 'Contas e estações',
  logs_e_auditoria: 'Logs e auditoria',
  outros: 'Outros',
}

const CORES_CATEGORIA_BANCO = {
  dados_meteorologicos: '#4a6fa5',
  contas_e_estacoes: '#8b5cf6',
  logs_e_auditoria: '#f59e0b',
  outros: '#94a3b8',
}

const ROTULOS_TABELA = {
  contas: 'Contas',
  estacoes: 'Estações',
  leituras: 'Leituras',
  solicitacoes_rssi: 'Solicitações de RSSI',
  log_auditoria: 'Eventos de auditoria',
}

// Todo serviço de terceiro que o sistema realmente chama, e pra que
// serve — pra não deixar a usuária adivinhando o que é "API externa".
const INTEGRACOES = [
  {
    chave: 'inmet',
    nome: 'INMET',
    descricao: 'Estações meteorológicas, previsão do tempo e avisos oficiais — usado na aba "Clima INMET".',
  },
  {
    chave: 'ibge',
    nome: 'IBGE',
    descricao: 'Lista de municípios por estado, usada no seletor de cidade da aba "Clima INMET".',
  },
  {
    chave: 'open_meteo',
    nome: 'Open-Meteo',
    descricao: 'Clima temporário no Dashboard, usado só até a estação própria da conta estar transmitindo.',
  },
  {
    chave: 'resend',
    nome: 'Resend',
    descricao: 'Envio do e-mail de confirmação de cadastro.',
  },
]

function statusIntegracao(chave, dados) {
  if (!dados) return { rotulo: '—', ativo: false }
  if (chave === 'resend') return { rotulo: dados.configurado ? 'Configurado' : 'Não configurado', ativo: dados.configurado }
  return { rotulo: dados.online ? 'Online' : 'Fora do ar', ativo: dados.online }
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

// Tela "Manutenção" do Painel Administrativo — só o lado técnico da
// operação (banco de dados, ambiente, integrações externas) e as zonas
// de risco. Visão geral, distribuição de contas, crescimento e
// atividade recente já ficam no Dashboard — pra não mostrar a mesma
// informação duas vezes, cada uma dessas telas cobre uma metade.
// Tudo aqui é dado real: sem console de SQL nem botão de restauração —
// riscos desproporcionais pra uma ação de um clique, deixados de fora
// de propósito.
function ManutencaoAdmin() {
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [info, setInfo] = useState(null)
  const [erroInfo, setErroInfo] = useState(null)

  const [fraseDigitada, setFraseDigitada] = useState('')
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState(null)

  const [diasAntigas, setDiasAntigas] = useState(365)
  const [carregandoResumoAntigas, setCarregandoResumoAntigas] = useState(false)
  const [resumoAntigas, setResumoAntigas] = useState(null)
  const [fraseAntigas, setFraseAntigas] = useState('')
  const [executandoAntigas, setExecutandoAntigas] = useState(false)
  const [resultadoAntigas, setResultadoAntigas] = useState(null)

  async function carregarPrincipal() {
    try {
      const dadosResumo = await buscarResumoLimpeza()
      setResumo(dadosResumo)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar o resumo agora.')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarInfo() {
    try {
      const dados = await buscarInfoSistema()
      setInfo(dados)
      setErroInfo(null)
    } catch {
      setErroInfo('Não foi possível carregar as informações do sistema agora.')
    }
  }

  useEffect(() => {
    carregarPrincipal()
    carregarInfo()
  }, [])

  useEffect(() => {
    setCarregandoResumoAntigas(true)
    setResumoAntigas(null)
    buscarResumoLimpezaLeiturasAntigas(diasAntigas)
      .then(setResumoAntigas)
      .catch(() => setResumoAntigas(null))
      .finally(() => setCarregandoResumoAntigas(false))
  }, [diasAntigas])

  const dadosDonutBanco = info?.banco_por_categoria
    ? Object.entries(info.banco_por_categoria).map(([chave, valor]) => ({
        chave,
        rotulo: ROTULOS_CATEGORIA_BANCO[chave] ?? chave,
        cor: CORES_CATEGORIA_BANCO[chave] ?? '#94a3b8',
        ...valor,
      }))
    : []

  const nadaParaApagar =
    resumo && resumo.leituras === 0 && resumo.estacoes === 0 && resumo.contas === 0 && resumo.solicitacoes_rssi === 0

  async function aoConfirmarLimpeza() {
    if (
      !window.confirm(
        `Isso vai apagar ${resumo.contas} conta(s), ${resumo.estacoes} estação(ões) e ${resumo.leituras} leitura(s) PRA SEMPRE. Não tem como desfazer. Confirma?`,
      )
    ) {
      return
    }

    setExecutando(true)
    setErro(null)
    try {
      const dados = await executarLimpeza()
      setResultado(dados)
      setFraseDigitada('')
      await carregarPrincipal()
      await carregarInfo()
    } catch {
      setErro('Não foi possível concluir a limpeza. Tente de novo.')
    } finally {
      setExecutando(false)
    }
  }

  async function aoConfirmarLimpezaAntigas() {
    if (
      !window.confirm(
        `Isso vai apagar ${resumoAntigas.quantidade} leitura(s) com mais de ${diasAntigas} dia(s) PRA SEMPRE. Não tem como desfazer. Confirma?`,
      )
    ) {
      return
    }

    setExecutandoAntigas(true)
    try {
      const dados = await executarLimpezaLeiturasAntigas(diasAntigas)
      setResultadoAntigas(dados)
      setFraseAntigas('')
      const [novoResumoAntigas, novoResumo] = await Promise.all([
        buscarResumoLimpezaLeiturasAntigas(diasAntigas),
        buscarResumoLimpeza(),
      ])
      setResumoAntigas(novoResumoAntigas)
      setResumo(novoResumo)
      await carregarInfo()
    } catch {
      setResultadoAntigas(null)
    } finally {
      setExecutandoAntigas(false)
    }
  }

  const banner = (
    <div className={styles.banner}>
      <div className={styles.bannerConteudo}>
        <div className={styles.bannerIcone}>
          <Database size={26} />
        </div>
        <div>
          <h1 className={styles.bannerTitulo}>Manutenção do sistema</h1>
          <p className={styles.bannerSubtitulo}>Infraestrutura, banco de dados e zona de risco da plataforma.</p>
        </div>
      </div>
    </div>
  )

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {banner}
        <StatusMessage texto="Carregando..." />
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
          <span className={`${styles.cartaoIcone} ${styles.corRoxa}`}><HardDrive size={20} /></span>
          <span className={styles.cartaoValor}>{info?.banco?.tamanho_legivel ?? '—'}</span>
          <span className={styles.cartaoRotulo}>Banco de dados</span>
          {info?.banco?.percentual_uso != null && (
            <span className={styles.cartaoNota}>{info.banco.percentual_uso}% da cota</span>
          )}
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corAzul}`}><Cpu size={20} /></span>
          <span className={styles.cartaoValor}>Django {info?.ambiente?.django_versao ?? '—'}</span>
          <span className={styles.cartaoRotulo}>Backend (1 processo)</span>
          <span className={info?.ambiente?.debug ? styles.pillOffline : styles.pillOnline}>
            {info?.ambiente ? (info.ambiente.debug ? 'DEBUG ativo' : 'DEBUG desligado') : '—'}
          </span>
        </div>

        <div className={styles.cartao}>
          <span className={`${styles.cartaoIcone} ${styles.corVerde}`}><Bell size={20} /></span>
          <span className={styles.cartaoValor}>{info?.contagens?.log_auditoria ?? '—'}</span>
          <span className={styles.cartaoRotulo}>Eventos de auditoria</span>
        </div>
      </div>

      <div className={styles.linhaResumo}>
        <div className={styles.itemResumo}>
          <span className={styles.itemResumoRotulo}>Leituras processadas ({info?.leituras_periodo?.dias ?? 30}d)</span>
          <span className={styles.itemResumoValor}>{info?.leituras_periodo?.total ?? '—'}</span>
          <ItemTendencia percentual={info?.leituras_periodo?.tendencia ?? null} />
        </div>
        <div className={styles.itemResumo}>
          <span className={styles.itemResumoRotulo}>Armazenamento utilizado</span>
          <span className={styles.itemResumoValor}>{info?.banco?.tamanho_legivel ?? '—'}</span>
          {info?.banco?.percentual_uso != null && (
            <span className={styles.itemResumoNota}>{info.banco.percentual_uso}% da cota</span>
          )}
        </div>
      </div>

      <div className={styles.cartaoBloco}>
        <div className={styles.blocoCabecalho}>
          <h2 className={styles.blocoTitulo}><Database size={16} /> Uso do banco de dados</h2>
        </div>
        <p className={styles.blocoSubtitulo}>Espaço ocupado por categoria de tabela</p>
        {!info?.banco_por_categoria ? (
          <p className={styles.semDados}>Só disponível com banco Postgres (não aparece no ambiente de desenvolvimento).</p>
        ) : (
          <div className={styles.donutLinha}>
            <div className={styles.donutContainer}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={dadosDonutBanco} dataKey="percentual" innerRadius={44} outerRadius={70} startAngle={90} endAngle={-270}>
                    {dadosDonutBanco.map((fatia) => (
                      <Cell key={fatia.chave} fill={fatia.cor} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.donutCentro}>
                <span className={styles.donutTotal}>{info.banco.tamanho_legivel}</span>
                <span className={styles.donutRotulo}>total</span>
              </div>
            </div>
            <ul className={styles.legendaDonut}>
              {dadosDonutBanco.map((fatia) => (
                <li key={fatia.chave}>
                  <span className={styles.pontoLegenda} style={{ backgroundColor: fatia.cor }} />
                  <span className={styles.legendaNome}>{fatia.rotulo}</span>
                  <span className={styles.legendaValores}>
                    <span className={styles.legendaValor}>{fatia.tamanho_legivel}</span>
                    <span className={styles.legendaPercentual}>{fatia.percentual}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.cartaoBloco}>
        <div className={styles.blocoCabecalho}>
          <h2 className={styles.blocoTitulo}><Globe size={16} /> APIs externas</h2>
        </div>
        <p className={styles.blocoSubtitulo}>Serviços de terceiros que o sistema usa e pra que servem</p>
        {erroInfo ? (
          <p className={styles.semDados}>{erroInfo}</p>
        ) : (
          <ul className={styles.listaIntegracoes}>
            {INTEGRACOES.map((item) => {
              const { rotulo, ativo } = statusIntegracao(item.chave, info?.integracoes?.[item.chave])
              return (
                <li key={item.chave}>
                  <div className={styles.integracaoInfo}>
                    <span className={styles.integracaoNome}>{item.nome}</span>
                    <span className={styles.integracaoDescricao}>{item.descricao}</span>
                  </div>
                  <span className={ativo ? styles.pillOnline : styles.pillOffline}>{rotulo}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className={styles.linha2Colunas}>
        <div className={styles.cartaoBloco}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}>Ações rápidas</h2>
          </div>
          <div className={styles.acoesRapidas}>
            <Link to="/app/adm/contas" className={styles.acaoRapida}>
              <Users size={18} />
              <span>Contas</span>
            </Link>
            <Link to="/app/adm/estacoes" className={styles.acaoRapida}>
              <Radio size={18} />
              <span>Estações</span>
            </Link>
            <Link to="/app/adm/notificacoes" className={styles.acaoRapida}>
              <Bell size={18} />
              <span>Notificações</span>
            </Link>
            <Link to="/app/adm/configuracoes" className={styles.acaoRapida}>
              <Settings size={18} />
              <span>Configurações</span>
            </Link>
          </div>
        </div>

        <div className={styles.cartaoBloco}>
          <div className={styles.blocoCabecalho}>
            <h2 className={styles.blocoTitulo}><HardDrive size={16} /> Tabelas principais</h2>
          </div>
          <p className={styles.blocoSubtitulo}>Quantidade de registros por tabela</p>
          <ul className={styles.listaUso}>
            {Object.entries(ROTULOS_TABELA).map(([chave, rotulo]) => (
              <li key={chave}>
                <Database size={14} />
                <span>{rotulo}</span>
                <strong>{info?.contagens?.[chave] ?? '—'}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.cartaoPerigo}>
        <div className={styles.cabecalhoPerigo}>
          <Trash2 size={22} />
          <div>
            <h2 className={styles.tituloPerigo}>Limpar leituras antigas</h2>
            <p className={styles.textoPerigo}>
              Apaga só as leituras de clima mais velhas que o período escolhido — não mexe em contas, estações nem no
              restante do histórico. <strong>Essa ação não pode ser desfeita.</strong>
            </p>
          </div>
        </div>

        <div className={styles.controleDias}>
          <label htmlFor="dias-antigas">Apagar leituras com mais de</label>
          <input
            id="dias-antigas"
            type="number"
            min="1"
            className={styles.inputDias}
            value={diasAntigas}
            onChange={(e) => setDiasAntigas(Math.max(Number(e.target.value) || 1, 1))}
          />
          <span>dia(s)</span>
          {carregandoResumoAntigas && <IndicadorAtualizando />}
        </div>

        {resumoAntigas && (
          <div className={styles.grade}>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumoAntigas.quantidade}</span>
              <span className={styles.itemRotulo}>leitura(s) seriam apagadas</span>
            </div>
          </div>
        )}

        {carregandoResumoAntigas ? null : resumoAntigas && resumoAntigas.quantidade === 0 ? (
          <p className={styles.avisoVazio}>
            <AlertTriangle size={15} />
            Não há leituras mais velhas que {diasAntigas} dia(s) agora.
          </p>
        ) : (
          <div className={styles.blocoConfirmacao}>
            <label className={styles.rotuloConfirmacao} htmlFor="frase-confirmacao-antigas">
              Pra habilitar o botão, digite <strong>{FRASE_CONFIRMACAO_ANTIGAS}</strong> abaixo:
            </label>
            <input
              id="frase-confirmacao-antigas"
              className={styles.inputConfirmacao}
              value={fraseAntigas}
              onChange={(e) => setFraseAntigas(e.target.value)}
              placeholder={FRASE_CONFIRMACAO_ANTIGAS}
              autoComplete="off"
            />
            <button
              type="button"
              className={styles.botaoApagar}
              disabled={fraseAntigas !== FRASE_CONFIRMACAO_ANTIGAS || executandoAntigas || !resumoAntigas}
              onClick={aoConfirmarLimpezaAntigas}
            >
              <Trash2 size={16} />
              {executandoAntigas ? 'Apagando...' : 'Apagar leituras antigas'}
            </button>
          </div>
        )}

        {resultadoAntigas && (
          <div className={styles.cartaoResultado}>
            <RefreshCw size={16} />
            Pronto: {resultadoAntigas.quantidade} leitura(s) com mais de {resultadoAntigas.dias} dia(s) apagadas.
          </div>
        )}
      </div>

      {resumo && (
        <div className={styles.cartaoPerigo}>
          <div className={styles.cabecalhoPerigo}>
            <ShieldAlert size={22} />
            <div>
              <h2 className={styles.tituloPerigo}>Apagar contas e dados de clima</h2>
              <p className={styles.textoPerigo}>
                Apaga todas as contas cadastradas (menos a sua, de superusuário), todas as estações e todo o
                histórico de leituras já recebido. <strong>Não apaga</strong> os planos, as funcionalidades nem o
                token de credenciamento — o sistema continua pronto pra receber cadastros novos depois.
                <strong> Essa ação não pode ser desfeita.</strong>
              </p>
            </div>
          </div>

          <div className={styles.grade}>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.contas}</span>
              <span className={styles.itemRotulo}>conta(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.estacoes}</span>
              <span className={styles.itemRotulo}>estação(ões)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.leituras}</span>
              <span className={styles.itemRotulo}>leitura(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.solicitacoes_rssi}</span>
              <span className={styles.itemRotulo}>solicitação(ões) RSSI</span>
            </div>
          </div>

          <p className={styles.preservados}>
            Preservado(s): conta(s) superusuário {resumo.superusuarios_preservados.join(', ')}, planos,
            funcionalidades e token de credenciamento.
          </p>

          {nadaParaApagar ? (
            <p className={styles.avisoVazio}>
              <AlertTriangle size={15} />
              Não há nada pra apagar agora — já está tudo zerado.
            </p>
          ) : (
            <div className={styles.blocoConfirmacao}>
              <label className={styles.rotuloConfirmacao} htmlFor="frase-confirmacao">
                Pra habilitar o botão, digite <strong>{FRASE_CONFIRMACAO}</strong> abaixo:
              </label>
              <input
                id="frase-confirmacao"
                className={styles.inputConfirmacao}
                value={fraseDigitada}
                onChange={(e) => setFraseDigitada(e.target.value)}
                placeholder={FRASE_CONFIRMACAO}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.botaoApagar}
                disabled={fraseDigitada !== FRASE_CONFIRMACAO || executando}
                onClick={aoConfirmarLimpeza}
              >
                <Trash2 size={16} />
                {executando ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className={styles.cartaoResultado}>
          <RefreshCw size={16} />
          Pronto: {resultado.contas} conta(s), {resultado.estacoes} estação(ões) e {resultado.leituras} leitura(s)
          apagadas.
        </div>
      )}
    </div>
  )
}

export default ManutencaoAdmin
