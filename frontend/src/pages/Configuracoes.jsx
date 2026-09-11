import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useMinhaEstacao } from '../hooks/useMinhaEstacao'
import { buscarMeuPerfil, trocarMinhaSenha } from '../services/perfilService'
import { CORES_PRINCIPAIS } from '../services/aparenciaService'
import styles from './Configuracoes.module.css'

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
  const { t } = useTranslation()
  const { tema, onAlternarTema, corPrincipal, onMudarCorPrincipal, idioma, onMudarIdioma } = useOutletContext()
  const { estacao } = useMinhaEstacao()
  const [perfil, setPerfil] = useState(null)

  const refsSecao = useRef({})

  // Geral
  const [fusoHorario, setFusoHorario] = useState('gmt-3')
  const [formatoData, setFormatoData] = useState('dd/mm/aaaa')
  const [formatoHora, setFormatoHora] = useState('24h')

  // Notificações
  const [emailAtivo, setEmailAtivo] = useState(true)
  const [dashboardAtivo, setDashboardAtivo] = useState(true)
  const [resumoDiario, setResumoDiario] = useState(false)
  const [somAlerta, setSomAlerta] = useState(true)

  // Atualização de dados
  const [intervaloAtualizacao, setIntervaloAtualizacao] = useState('5min')
  const [unidadeTempoGraficos, setUnidadeTempoGraficos] = useState('1h')
  const [retencaoDados, setRetencaoDados] = useState('30dias')


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
      setErroSenha(dados?.senha_atual?.[0] || dados?.password?.[0] || t('configuracoes.erroSenhaPadrao'))
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
    onMudarIdioma('pt')
    setEmailAtivo(true)
    setDashboardAtivo(true)
    setResumoDiario(false)
    setSomAlerta(true)
    setIntervaloAtualizacao('5min')
    setUnidadeTempoGraficos('1h')
    setRetencaoDados('30dias')
    onMudarCorPrincipal('azul')
    setUnidadeTemperatura('c')
    setUnidadeVento('kmh')
    setUnidadePrecipitacao('mm')
    setFormatoExportacao('pdf')
  }

  function aoConfirmarExclusao() {
    setAvisoExclusao(t('configuracoes.exclusaoIndisponivel'))
    setConfirmandoExclusao(false)
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Settings size={22} />
            {t('configuracoes.titulo')}
          </h1>
          <p className={styles.subtitulo}>{t('configuracoes.subtitulo')}</p>
        </div>
        {estacao && (
          <div className={styles.chipEstacao}>
            <div>
              <span className={styles.chipEstacaoTitulo}>{t('configuracoes.estacaoAtiva')}</span>
              <span className={styles.chipEstacaoValor}>
                <span className={styles.pontoOnline} />
                {estacao.identificador}
              </span>
            </div>
            <button type="button" className={styles.botaoContorno} onClick={() => irParaSecao('estacao')}>
              {t('configuracoes.verDetalhes')}
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
              {t('configuracoes.geralTitulo')}
            </h2>
            <div className={styles.gradeCampos4}>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.fusoHorario')}</label>
                <select className={styles.select} value={fusoHorario} onChange={(e) => setFusoHorario(e.target.value)}>
                  <option value="gmt-3">{t('configuracoes.fusoBrasilia')}</option>
                  <option value="gmt-4">{t('configuracoes.fusoManaus')}</option>
                  <option value="gmt-5">{t('configuracoes.fusoRioBranco')}</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.formatoData')}</label>
                <select className={styles.select} value={formatoData} onChange={(e) => setFormatoData(e.target.value)}>
                  <option value="dd/mm/aaaa">31/12/2026</option>
                  <option value="mm/dd/aaaa">12/31/2026</option>
                  <option value="aaaa-mm-dd">2026-12-31</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.formatoHora')}</label>
                <select className={styles.select} value={formatoHora} onChange={(e) => setFormatoHora(e.target.value)}>
                  <option value="24h">{t('configuracoes.hora24')}</option>
                  <option value="12h">{t('configuracoes.hora12')}</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.idioma')}</label>
                <select className={styles.select} value={idioma} onChange={(e) => onMudarIdioma(e.target.value)}>
                  <option value="pt">Português (Brasil)</option>
                  <option value="en">English (US)</option>
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
                {t('configuracoes.notificacoesTitulo')}
              </h2>
              <ul className={styles.listaToggles}>
                <li>
                  <span>
                    <strong>{t('configuracoes.emailTitulo')}</strong>
                    <small>{t('configuracoes.emailDesc')}</small>
                  </span>
                  <Toggle ativo={emailAtivo} onClick={() => setEmailAtivo((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>{t('configuracoes.dashboardTitulo')}</strong>
                    <small>{t('configuracoes.dashboardDesc')}</small>
                  </span>
                  <Toggle ativo={dashboardAtivo} onClick={() => setDashboardAtivo((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>{t('configuracoes.resumoTitulo')}</strong>
                    <small>{t('configuracoes.resumoDesc')}</small>
                  </span>
                  <Toggle ativo={resumoDiario} onClick={() => setResumoDiario((v) => !v)} />
                </li>
                <li>
                  <span>
                    <strong>{t('configuracoes.somTitulo')}</strong>
                    <small>{t('configuracoes.somDesc')}</small>
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
                {t('configuracoes.aparenciaTitulo')}
              </h2>
              <div className={styles.blocoAparencia}>
                <label className={styles.rotuloCampo}>{t('configuracoes.temaTitulo')}</label>
                <p className={styles.descricaoCampo}>{t('configuracoes.temaDesc')}</p>
                <div className={styles.segmentado}>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentadaIcone} ${tema === 'dia' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => tema !== 'dia' && onAlternarTema()}
                    aria-label={t('nav.temaClaro')}
                  >
                    <Sun size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.opcaoSegmentadaIcone} ${tema === 'noite' ? styles.opcaoSegmentadaAtiva : ''}`}
                    onClick={() => tema !== 'noite' && onAlternarTema()}
                    aria-label={t('nav.temaEscuro')}
                  >
                    <Moon size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.blocoAparencia}>
                <label className={styles.rotuloCampo}>{t('configuracoes.corTitulo')}</label>
                <p className={styles.descricaoCampo}>{t('configuracoes.corDesc')}</p>
                <div className={styles.swatches}>
                  {CORES_PRINCIPAIS.map((cor) => (
                    <button
                      key={cor.valor}
                      type="button"
                      className={styles.swatch}
                      style={{ backgroundColor: cor.hex }}
                      aria-label={cor.valor}
                      onClick={() => onMudarCorPrincipal(cor.valor)}
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
              {t('configuracoes.atualizacaoTitulo')}
            </h2>
            <div className={styles.gradeCampos3}>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.intervaloTitulo')}</label>
                <p className={styles.descricaoCampo}>{t('configuracoes.intervaloDesc')}</p>
                <select
                  className={styles.select}
                  value={intervaloAtualizacao}
                  onChange={(e) => setIntervaloAtualizacao(e.target.value)}
                >
                  <option value="1min">{t('configuracoes.min1')}</option>
                  <option value="5min">{t('configuracoes.min5')}</option>
                  <option value="15min">{t('configuracoes.min15')}</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.unidadeGraficosTitulo')}</label>
                <p className={styles.descricaoCampo}>{t('configuracoes.agruparPor')}</p>
                <select
                  className={styles.select}
                  value={unidadeTempoGraficos}
                  onChange={(e) => setUnidadeTempoGraficos(e.target.value)}
                >
                  <option value="1h">{t('configuracoes.hora1')}</option>
                  <option value="1dia">{t('configuracoes.dia1')}</option>
                </select>
              </div>
              <div>
                <label className={styles.rotuloCampo}>{t('configuracoes.retencaoTitulo')}</label>
                <p className={styles.descricaoCampo}>{t('configuracoes.retencaoDesc')}</p>
                <select className={styles.select} value={retencaoDados} onChange={(e) => setRetencaoDados(e.target.value)}>
                  <option value="30dias">{t('configuracoes.dias30')}</option>
                  <option value="90dias">{t('configuracoes.dias90')}</option>
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
              {t('configuracoes.unidadesTitulo')}
            </h2>
            <ul className={styles.listaUnidades}>
              <li>
                <span>{t('configuracoes.temperatura')}</span>
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
                <span>{t('configuracoes.vento')}</span>
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
                <span>{t('configuracoes.precipitacao')}</span>
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
                    {idioma === 'en' ? 'in' : 'pol'}
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
                {t('configuracoes.privacidadeTitulo')}
              </h2>
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <KeyRound size={15} />
                    <span>
                      <strong>{t('configuracoes.alterarSenha')}</strong>
                      <small>{t('configuracoes.alterarSenhaDesc')}</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.botaoContorno}
                    onClick={() => setTrocandoSenhaAberto((v) => !v)}
                  >
                    {trocandoSenhaAberto ? t('configuracoes.cancelar') : t('configuracoes.alterarSenha')}
                    <ChevronRight size={14} />
                  </button>
                </li>

                {trocandoSenhaAberto && (
                  <form className={styles.formSenha} onSubmit={aoTrocarSenha}>
                    <label className={styles.rotuloCampo}>{t('configuracoes.senhaAtual')}</label>
                    <input
                      className={styles.campo}
                      type="password"
                      value={senhaAtual}
                      onChange={(e) => setSenhaAtual(e.target.value)}
                      required
                    />
                    <label className={styles.rotuloCampo}>{t('configuracoes.novaSenha')}</label>
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
                      {trocandoSenha ? t('configuracoes.alterando') : t('configuracoes.confirmarNovaSenha')}
                    </button>
                  </form>
                )}

                <li>
                  <span>
                    <Monitor size={15} />
                    <span>
                      <strong>{t('configuracoes.sessoesAtivas')}</strong>
                      <small>{t('configuracoes.sessoesDesc')}</small>
                    </span>
                  </span>
                  <span className={styles.valorEmBreve}>{t('configuracoes.emBreve')}</span>
                </li>
                <li>
                  <span>
                    <Smartphone size={15} />
                    <span>
                      <strong>{t('configuracoes.doisFatores')}</strong>
                      <small>{t('configuracoes.doisFatoresDesc')}</small>
                    </span>
                  </span>
                  <span className={styles.valorEmBreve}>{t('configuracoes.emBreve')}</span>
                </li>
              </ul>
              {senhaTrocada && <p className={styles.avisoSalvo}>{t('configuracoes.senhaAlterada')}</p>}
            </section>

            {/* Ações do sistema */}
            <section className={styles.cartao}>
              <h2 className={styles.tituloCartao}>
                <Settings size={17} />
                {t('configuracoes.acoesTitulo')}
              </h2>
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <RefreshCw size={15} />
                    <span>
                      <strong>{t('configuracoes.limparCache')}</strong>
                      <small>{t('configuracoes.limparCacheDesc')}</small>
                    </span>
                  </span>
                  <button type="button" className={styles.botaoContorno} onClick={aoLimparCache}>
                    {cacheLimpo ? t('configuracoes.limpo') : t('configuracoes.limpar')}
                  </button>
                </li>
                <li>
                  <span>
                    <RotateCcw size={15} />
                    <span>
                      <strong>{t('configuracoes.restaurarPadroes')}</strong>
                      <small>{t('configuracoes.restaurarDesc')}</small>
                    </span>
                  </span>
                  <button type="button" className={styles.botaoContorno} onClick={aoRestaurarPadroes}>
                    {t('configuracoes.restaurar')}
                  </button>
                </li>
                <li>
                  <span>
                    <Trash2 size={15} />
                    <span>
                      <strong>{t('configuracoes.excluirConta')}</strong>
                      <small>{t('configuracoes.excluirDesc')}</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.botaoPerigo}
                    onClick={() => setConfirmandoExclusao(true)}
                  >
                    {t('configuracoes.excluirConta')}
                  </button>
                </li>
              </ul>
              {confirmandoExclusao && (
                <div className={styles.avisoPerigo}>
                  <p>{t('configuracoes.confirmarExclusaoTexto')}</p>
                  <div className={styles.acoesAvisoPerigo}>
                    <button type="button" className={styles.botaoContorno} onClick={() => setConfirmandoExclusao(false)}>
                      {t('configuracoes.cancelar')}
                    </button>
                    <button type="button" className={styles.botaoPerigo} onClick={aoConfirmarExclusao}>
                      {t('configuracoes.simExcluir')}
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
              {t('configuracoes.estacaoTitulo')}
            </h2>
            {estacao ? (
              <ul className={styles.listaLinhas}>
                <li>
                  <span>
                    <Radio size={15} />
                    <span>
                      <strong>{estacao.identificador}</strong>
                      <small>
                        {estacao.esta_offline ? t('configuracoes.offline') : t('configuracoes.online')} ·{' '}
                        {t('configuracoes.vinculadaEm')}{' '}
                        {new Date(estacao.criado_em).toLocaleDateString(idioma === 'en' ? 'en-US' : 'pt-BR')}
                      </small>
                    </span>
                  </span>
                </li>
              </ul>
            ) : (
              <p className={styles.descricaoCampo}>{t('configuracoes.nenhumaEstacao')}</p>
            )}
            <p className={styles.descricaoCampo}>{t('configuracoes.estacaoTexto')}</p>
          </section>

          {/* Exportação de dados */}
          <section
            id="exportacao"
            ref={(el) => (refsSecao.current.exportacao = el)}
            className={styles.cartao}
          >
            <h2 className={styles.tituloCartao}>
              <Download size={17} />
              {t('configuracoes.exportacaoTitulo')}
            </h2>
            <label className={styles.rotuloCampo}>{t('configuracoes.formatoPadrao')}</label>
            <select className={styles.select} value={formatoExportacao} onChange={(e) => setFormatoExportacao(e.target.value)}>
              <option value="pdf">PDF</option>
              <option value="csv">{t('configuracoes.csv')}</option>
              <option value="txt">{t('configuracoes.txt')}</option>
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
              {t('configuracoes.sobreTitulo')}
            </h2>
            <ul className={styles.listaLinhas}>
              <li>
                <span>
                  <span>
                    <strong>{t('configuracoes.nomeSistema')}</strong>
                    <small>LACOP/UFF</small>
                  </span>
                </span>
                <span className={styles.valorEmBreve}>v1.0.0</span>
              </li>
              {perfil && (
                <li>
                  <span>
                    <span>
                      <strong>{t('configuracoes.conta')}</strong>
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
