import { useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Settings,
  SlidersHorizontal,
  Bell,
  RefreshCw,
  Palette,
  Ruler,
  Lock,
  Radio,
  Download,
  Info,
  Sun,
  Moon,
  Check,
  KeyRound,
  Monitor,
  Smartphone,
  Trash2,
  RotateCcw,
  ChevronRight,
} from 'lucide-react'
import { obterEstacaoVinculada, desvincularEstacao } from '../services/estacaoService'
import { buscarMeuPerfil, trocarMinhaSenha } from '../services/perfilService'
import styles from './Configuracoes.module.css'

const CORES_PRINCIPAIS = [
  { valor: 'azul', hex: '#2f6fed' },
  { valor: 'verde', hex: '#22c55e' },
  { valor: 'roxo', hex: '#8b5cf6' },
  { valor: 'laranja', hex: '#f59e0b' },
  { valor: 'vermelho', hex: '#ef4444' },
]

function Toggle({ ativo, onClick }) {
  return (
    <button type="button" className={`${styles.toggle} ${ativo ? styles.toggleAtivo : ''}`} onClick={onClick}>
      <span className={styles.toggleBolinha} />
    </button>
  )
}

// Tela de Configurações — preferências gerais, notificações, unidades de
// medida, aparência, privacidade/segurança, estação vinculada, exportação
// e informações do sistema. A maior parte é local (não persiste no
// backend ainda — não existe endpoint de preferências); exceções reais:
// tema (compartilhado com o resto do app) e troca de senha.
function Configuracoes() {
  const navigate = useNavigate()
  const { tema, onAlternarTema } = useOutletContext()
  const estacao = obterEstacaoVinculada()
  const [perfil, setPerfil] = useState(null)

  const refsSecao = useRef({})

  // Geral
  const [fusoHorario, setFusoHorario] = useState('gmt-3')
  const [formatoData, setFormatoData] = useState('dd/mm/aaaa')
  const [formatoHora, setFormatoHora] = useState('24h')
  const [idioma, setIdioma] = useState('pt-br')

  // Notificações
  const [emailAtivo, setEmailAtivo] = useState(true)
  const [dashboardAtivo, setDashboardAtivo] = useState(true)
  const [resumoDiario, setResumoDiario] = useState(false)
  const [somAlerta, setSomAlerta] = useState(true)

  // Atualização de dados
  const [intervaloAtualizacao, setIntervaloAtualizacao] = useState('5min')
  const [unidadeTempoGraficos, setUnidadeTempoGraficos] = useState('1h')
  const [retencaoDados, setRetencaoDados] = useState('30dias')

  // Aparência
  const [corPrincipal, setCorPrincipal] = useState('azul')

  // Unidades de medida
  const [unidadeTemperatura, setUnidadeTemperatura] = useState('c')
  const [unidadeVento, setUnidadeVento] = useState('kmh')
  const [unidadePrecipitacao, setUnidadePrecipitacao] = useState('mm')

  // Privacidade e segurança
  const [trocandoSenhaAberto, setTrocandoSenhaAberto] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [trocandoSenha, setTrocandoSenha] = useState(false)
  const [senhaTrocada, setSenhaTrocada] = useState(false)
  const [erroSenha, setErroSenha] = useState('')

  // Exportação
  const [formatoExportacao, setFormatoExportacao] = useState('pdf')

  // Ações do sistema
  const [cacheLimpo, setCacheLimpo] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [avisoExclusao, setAvisoExclusao] = useState('')

  useEffect(() => {
    buscarMeuPerfil().then(setPerfil).catch(() => {})
  }, [])

  function irParaSecao(id) {
    refsSecao.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function aoTrocarSenha(evento) {
    evento.preventDefault()
    setErroSenha('')
    setTrocandoSenha(true)
    try {
      await trocarMinhaSenha(perfil.id, senhaAtual, novaSenha)
      setSenhaAtual('')
      setNovaSenha('')
      setSenhaTrocada(true)
      setTrocandoSenhaAberto(false)
      setTimeout(() => setSenhaTrocada(false), 2500)
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      setErroSenha(dados?.senha_atual?.[0] || dados?.password?.[0] || 'Não foi possível trocar a senha.')
    } finally {
      setTrocandoSenha(false)
    }
  }

  function aoLimparCache() {
    setCacheLimpo(true)
    setTimeout(() => setCacheLimpo(false), 2500)
  }

  function aoRestaurarPadroes() {
    setFusoHorario('gmt-3')
    setFormatoData('dd/mm/aaaa')
    setFormatoHora('24h')
    setIdioma('pt-br')
    setEmailAtivo(true)
    setDashboardAtivo(true)
    setResumoDiario(false)
    setSomAlerta(true)
    setIntervaloAtualizacao('5min')
    setUnidadeTempoGraficos('1h')
    setRetencaoDados('30dias')
    setCorPrincipal('azul')
    setUnidadeTemperatura('c')
    setUnidadeVento('kmh')
    setUnidadePrecipitacao('mm')
    setFormatoExportacao('pdf')
  }

  function aoConfirmarExclusao() {
    setAvisoExclusao('Exclusão de conta ainda não está disponível por autoatendimento — fale com um administrador.')
    setConfirmandoExclusao(false)
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Settings size={22} />
            Configurações
          </h1>
          <p className={styles.subtitulo}>Personalize sua experiência e gerencie as preferências do sistema.</p>
        </div>
        {estacao && (
          <div className={styles.chipEstacao}>
            <div>
              <span className={styles.chipEstacaoTitulo}>Estação ativa</span>
              <span className={styles.chipEstacaoValor}>
                <span className={styles.pontoOnline} />
                {estacao.identificador}
              </span>
            </div>
            <button type="button" className={styles.botaoContorno} onClick={() => irParaSecao('estacao')}>
              Ver detalhes
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.colunaConteudo}>
          {/* Geral */}
          <section
            id="geral"
            ref={(el) => (refsSecao.current.geral = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <SlidersHorizontal size={17} />
              Preferências gerais
            </h2>
            <div className={styles.gradeCampos4}>
              <div>
                <label className={styles.rotuloCampo}>Fuso horário</label>
                <select className={styles.select} value={fusoHorario} onChange={(e) => setFusoHorario(e.target.value)}>
                  <option value="gmt-3">(GMT-03:00) Brasília</option>
                  <option value="gmt-4">(GMT-04:00) Manaus</option>
                  <option value="gmt-5">(GMT-05:00) Rio Branco</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>Formato de data</label>
                <select className={styles.select} value={formatoData} onChange={(e) => setFormatoData(e.target.value)}>
                  <option value="dd/mm/aaaa">31/12/2026</option>
                  <option value="mm/dd/aaaa">12/31/2026</option>
                  <option value="aaaa-mm-dd">2026-12-31</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>Formato de hora</label>
                <select className={styles.select} value={formatoHora} onChange={(e) => setFormatoHora(e.target.value)}>
                  <option value="24h">24 horas (14:30)</option>
                  <option value="12h">12 horas (2:30 PM)</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>Idioma do sistema</label>
                <select className={styles.select} value={idioma} onChange={(e) => setIdioma(e.target.value)}>
                  <option value="pt-br">Português (Brasil)</option>
                  <option value="en-us">English (US)</option>
                </select>
              </div>
            </div>
          </section>

          <div className={styles.linha2Colunas}>
            {/* Notificações */}
            <section
              id="notificacoes"
              ref={(el) => (refsSecao.current.notificacoes = el)}
              className={styles.cartao}
            >
              <h2 className={styles.tituloCartao}>
                <Bell size={17} />
                Notificações
              </h2>
              <ul className={styles.listaToggles}>
                <li>
                  <span>
                    <strong>Alertas por e-mail</strong>
                    <small>Receba alertas críticos e avisos importantes por e-mail.</small>
                  </span>
                  <Toggle ativo={emailAtivo} onClick={() => setEmailAtivo((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>Alertas no dashboard</strong>
                    <small>Exibir alertas e avisos em tempo real no dashboard.</small>
                  </span>
                  <Toggle ativo={dashboardAtivo} onClick={() => setDashboardAtivo((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>Resumo diário</strong>
                    <small>Receba um resumo diário das condições meteorológicas.</small>
                  </span>
                  <Toggle ativo={resumoDiario} onClick={() => setResumoDiario((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>Som de alerta</strong>
                    <small>Reproduzir som ao receber alertas críticos.</small>
                  </span>
                  <Toggle ativo={somAlerta} onClick={() => setSomAlerta((v) => !v)} />
                </li>
              </ul>
            </section>

            {/* Aparência */}
            <section
              id="aparencia"
              ref={(el) => (refsSecao.current.aparencia = el)}
              className={styles.cartao}
            >
              <h2 className={styles.tituloCartao}>
                <Palette size={17} />
                Aparência
              </h2>
              <div className={styles.blocoAparencia}>
                <label className={styles.rotuloCampo}>Tema do sistema</label>
                <p className={styles.descricaoCampo}>Escolha entre o tema claro ou escuro.</p>
                <div className={styles.segmentado}>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentadaIcone} ${tema === 'dia' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => tema !== 'dia' && onAlternarTema()}
                    aria-label="Tema claro"
                  >
                    <Sun size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentadaIcone} ${tema === 'noite' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => tema !== 'noite' && onAlternarTema()}
                    aria-label="Tema escuro"
                  >
                    <Moon size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.blocoAparencia}>
                <label className={styles.rotuloCampo}>Cor principal</label>
                <p className={styles.descricaoCampo}>Personalize a cor de destaque do sistema.</p>
                <div className={styles.swatches}>
                  {CORES_PRINCIPAIS.map((cor) => (
                    <button
                      key={cor.valor}
                      type="button"
                      className={styles.swatch}
                      style={{ backgroundColor: cor.hex }}
                      aria-label={cor.valor}
                      onClick={() => setCorPrincipal(cor.valor)}
                    >
                      {corPrincipal === cor.valor && <Check size={14} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Atualização de dados */}
          <section className={styles.cartao}>
            <h2 className={styles.tituloCartao}>
              <RefreshCw size={17} />
              Atualização de dados
            </h2>
            <div className={styles.gradeCampos3}>
              <div>
                <label className={styles.rotuloCampo}>Intervalo de atualização</label>
                <p className={styles.descricaoCampo}>Defina a frequência de atualização dos dados no sistema.</p>
                <select
                  className={styles.select}
                  value={intervaloAtualizacao}
                  onChange={(e) => setIntervaloAtualizacao(e.target.value)}
                >
                  <option value="1min">1 minuto</option>
                  <option value="5min">5 minutos</option>
                  <option value="15min">15 minutos</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>Unidade de tempo para gráficos</label>
                <p className={styles.descricaoCampo}>Agrupar dados por:</p>
                <select
                  className={styles.select}
                  value={unidadeTempoGraficos}
                  onChange={(e) => setUnidadeTempoGraficos(e.target.value)}
                >
                  <option value="1h">1 hora</option>
                  <option value="1dia">1 dia</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>Retenção de dados</label>
                <p className={styles.descricaoCampo}>Tempo que os dados serão mantidos no sistema.</p>
                <select className={styles.select} value={retencaoDados} onChange={(e) => setRetencaoDados(e.target.value)}>
                  <option value="30dias">30 dias</option>
                  <option value="90dias">90 dias</option>
                </select>
              </div>
            </div>
          </section>

          {/* Unidades de medida */}
          <section
            id="unidades"
            ref={(el) => (refsSecao.current.unidades = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <Ruler size={17} />
              Unidades de medida
            </h2>
            <ul className={styles.listaUnidades}>
              <li>
                <span>Temperatura</span>
                <div className={styles.segmentado}>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadeTemperatura === 'c' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadeTemperatura('c')}
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadeTemperatura === 'f' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadeTemperatura('f')}
                  >
                    °F
                  </button>
                </div>
              </li>
              <li>
                <span>Velocidade do vento</span>
                <div className={styles.segmentado}>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadeVento === 'ms' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadeVento('ms')}
                  >
                    m/s
                  </button>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadeVento === 'kmh' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadeVento('kmh')}
                  >
                    km/h
                  </button>
                </div>
              </li>
              <li>
                <span>Precipitação</span>
                <div className={styles.segmentado}>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadePrecipitacao === 'mm' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadePrecipitacao('mm')}
                  >
                    mm
                  </button>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentada} ${unidadePrecipitacao === 'pol' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => setUnidadePrecipitacao('pol')}
                  >
                    pol
                  </button>
                </div>
              </li>
            </ul>
          </section>

          <div className={styles.linha2Colunas}>
            {/* Privacidade e segurança */}
            <section
              id="privacidade"
              ref={(el) => (refsSecao.current.privacidade = el)}
              className={styles.cartao}
            >
              <h2 className={styles.tituloCartao}>
                <Lock size={17} />
                Privacidade e segurança
              </h2>
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <KeyRound size={15} />
                    <span>
                      <strong>Alterar senha</strong>
                      <small>Atualize sua senha de acesso.</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.botaoContorno}
                    onClick={() => setTrocandoSenhaAberto((v) => !v)}
                  >
                    {trocandoSenhaAberto ? 'Cancelar' : 'Alterar senha'}
                    <ChevronRight size={14} />
                  </button>
                </li>

                {trocandoSenhaAberto && (
                  <form className={styles.formSenha} onSubmit={aoTrocarSenha}>
                    <label className={styles.rotuloCampo}>Senha atual</label>
                    <input
                      className={styles.campo}
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      required
                    />
                    <label className={styles.rotuloCampo}>Nova senha</label>
                    <input
                      className={styles.campo}
                      type="password"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      minLength={8}
                      required
                    />
                    {erroSenha && <p className={styles.erro}>{erroSenha}</p>}
                    <button type="submit" className={styles.botaoPrimario} disabled={trocandoSenha}>
                      {trocandoSenha ? 'Alterando...' : 'Confirmar nova senha'}
                    </button>
                  </form>
                )}

                <li>
                  <span>
                    <Monitor size={15} />
                    <span>
                      <strong>Sessões ativas</strong>
                      <small>Gerencie dispositivos conectados à sua conta.</small>
                    </span>
                  </span>
                  <span className={styles.valorEmBreve}>Em breve</span>
                </li>
                <li>
                  <span>
                    <Smartphone size={15} />
                    <span>
                      <strong>Autenticação em duas etapas</strong>
                      <small>Adicione uma camada extra de segurança à sua conta.</small>
                    </span>
                  </span>
                  <span className={styles.valorEmBreve}>Em breve</span>
                </li>
              </ul>
              {senhaTrocada && <p className={styles.avisoSalvo}>Senha alterada com sucesso.</p>}
            </section>

            {/* Ações do sistema */}
            <section className={styles.cartao}>
              <h2 className={styles.tituloCartao}>
                <Settings size={17} />
                Ações do sistema
              </h2>
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <RefreshCw size={15} />
                    <span>
                      <strong>Limpar cache</strong>
                      <small>Limpa os dados temporários do sistema.</small>
                    </span>
                  </span>
                  <button type="button" className={styles.botaoContorno} onClick={aoLimparCache}>
                    {cacheLimpo ? 'Limpo!' : 'Limpar'}
                  </button>
                </li>
                <li>
                  <span>
                    <RotateCcw size={15} />
                    <span>
                      <strong>Restaurar padrões</strong>
                      <small>Redefine todas as configurações para o padrão.</small>
                    </span>
                  </span>
                  <button type="button" className={styles.botaoContorno} onClick={aoRestaurarPadroes}>
                    Restaurar
                  </button>
                </li>
                <li>
                  <span>
                    <Trash2 size={15} />
                    <span>
                      <strong>Excluir conta</strong>
                      <small>Esta ação é permanente e não pode ser desfeita.</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.botaoPerigo}
                    onClick={() => setConfirmandoExclusao(true)}
                  >
                    Excluir conta
                  </button>
                </li>
              </ul>
              {confirmandoExclusao && (
                <div className={styles.avisoPerigo}>
                  <p>Tem certeza? Essa ação não pode ser desfeita.</p>
                  <div className={styles.acoesAvisoPerigo}>
                    <button type="button" className={styles.botaoContorno} onClick={() => setConfirmandoExclusao(false)}>
                      Cancelar
                    </button>
                    <button type="button" className={styles.botaoPerigo} onClick={aoConfirmarExclusao}>
                      Sim, excluir
                    </button>
                  </div>
                </div>
              )}
              {avisoExclusao && <p className={styles.avisoInfo}>{avisoExclusao}</p>}
            </section>
          </div>

          {/* Estação e dados */}
          <section
            id="estacao"
            ref={(el) => (refsSecao.current.estacao = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <Radio size={17} />
              Estação e dados
            </h2>
            {estacao ? (
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <Radio size={15} />
                    <span>
                      <strong>{estacao.identificador}</strong>
                      <small>Vinculada em {new Date(estacao.vinculadaEm).toLocaleDateString('pt-BR')}</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.botaoPerigo}
                    onClick={() => {
                      desvincularEstacao()
                      navigate(0)
                    }}
                  >
                    Desvincular
                  </button>
                </li>
              </ul>
            ) : (
              <p className={styles.descricaoCampo}>Nenhuma estação vinculada.</p>
            )}
          </section>

          {/* Exportação de dados */}
          <section
            id="exportacao"
            ref={(el) => (refsSecao.current.exportacao = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <Download size={17} />
              Exportação de dados
            </h2>
            <label className={styles.rotuloCampo}>Formato padrão de exportação</label>
            <select className={styles.select} value={formatoExportacao} onChange={(e) => setFormatoExportacao(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="csv">Planilha (CSV)</option>
              <option value="txt">Dados brutos (TXT)</option>
            </select>
          </section>

          {/* Sobre o sistema */}
          <section
            id="sobre"
            ref={(el) => (refsSecao.current.sobre = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <Info size={17} />
              Sobre o sistema
            </h2>
            <ul className={styles.listaLinhas}>
              <li>
                <span>
                  <span>
                    <strong>Sistema de Monitoramento Agroclimático</strong>
                    <small>LACOP/UFF</small>
                  </span>
                </span>
                <span className={styles.valorEmBreve}>v1.0.0</span>
              </li>
              {perfil && (
                <li>
                  <span>
                    <span>
                      <strong>Conta</strong>
                      <small>{perfil.email || perfil.username}</small>
                    </span>
                  </span>
                </li>
              )}
            </ul>
          </section>
        </div>
    </div>
  )
}

export default Configuracoes
