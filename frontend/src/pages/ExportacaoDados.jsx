import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, MapPin, FileText, FileSpreadsheet, FileType, CheckSquare, Square, Loader2 } from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual } from '../services/climaExternoService'
import { geocodificarCidade } from '../services/geocodingService'
import { obterLocalizacaoSelecionada } from '../services/localizacaoSelecionada'
import { METRICAS_CLIMA } from '../services/metricasClima'
import { gerarTxt, gerarCsv, gerarPdf, baixarArquivo } from '../services/exportacaoService'
import styles from './ExportacaoDados.module.css'

const OPCOES_FORMATO = [
  { valor: 'txt', chave: 'formatoTxt', icone: FileText },
  { valor: 'csv', chave: 'formatoCsv', icone: FileSpreadsheet },
  { valor: 'pdf', chave: 'formatoPdf', icone: FileType },
]

// "AAAA-marica-rj" — nome de arquivo sem acento/espaço/maiúscula.
function normalizarNomeArquivo(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Página de exportação (RF-23 a RF-25) — link próprio no menu, fora do
// fluxo dos gráficos, como pedido: "eu quero que a pessoa consiga baixar
// um arquivo txt ou pdf dos dados". Sem seletor de estação (RF-24 supõe
// várias estações atribuídas pelo admin, modelo que esta entrega ainda
// não tem — ver services/localizacaoSelecionada.js): exporta sempre a
// cidade escolhida no cabeçalho do Dashboard. Sem trava de plano por
// enquanto (RF-26 ficou "a confirmar" no documento de requisitos).
function ExportacaoDados() {
  const { t } = useTranslation()
  const [clima, setClima] = useState(null)
  const [nomeLocal, setNomeLocal] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [metricasSelecionadas, setMetricasSelecionadas] = useState(() => METRICAS_CLIMA.map((m) => m.chave))
  const [periodo, setPeriodo] = useState('hoje')
  const [formato, setFormato] = useState('txt')
  const [gerando, setGerando] = useState(false)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const { uf, cidade } = obterLocalizacaoSelecionada()
        const coordenadas = await geocodificarCidade(cidade, uf)
        const dados = await buscarClimaAtual(coordenadas)
        if (!cancelado) {
          setClima(dados)
          setNomeLocal(`${cidade} (${uf})`)
          setErro(null)
        }
      } catch {
        if (!cancelado) setErro(t('exportacao.erroCarregar'))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [t])

  const OPCOES_PERIODO = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
  ]

  function alternarMetrica(chave) {
    setMetricasSelecionadas((atual) => (atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]))
  }

  function aoClicarBaixar() {
    if (!clima || metricasSelecionadas.length === 0) return

    setGerando(true)
    try {
      const metricas = METRICAS_CLIMA.filter((m) => metricasSelecionadas.includes(m.chave))
      const periodoRotulo = OPCOES_PERIODO.find((o) => o.valor === periodo)?.rotulo ?? ''
      const args = { clima, periodo, periodoRotulo, local: nomeLocal, metricasSelecionadas: metricas }
      const nomeBase = `lacop-${normalizarNomeArquivo(nomeLocal)}-${periodo}`

      if (formato === 'txt') baixarArquivo(gerarTxt(args), `${nomeBase}.txt`)
      if (formato === 'csv') baixarArquivo(gerarCsv(args), `${nomeBase}.csv`)
      if (formato === 'pdf') baixarArquivo(gerarPdf(args), `${nomeBase}.pdf`)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Download size={22} />
            {t('exportacao.titulo')}
          </h1>
          <p className={styles.subtitulo}>{t('exportacao.subtitulo')}</p>
        </div>
      </div>

      {carregando ? (
        <StatusMessage texto={t('exportacao.carregando')} />
      ) : erro ? (
        <StatusMessage texto={erro} />
      ) : (
        <div className={styles.cartao}>
          <div className={styles.chipLocal}>
            <MapPin size={14} />
            {nomeLocal}
          </div>

          <section className={styles.secao}>
            <h2 className={styles.tituloSecao}>{t('exportacao.selecioneVariaveis')}</h2>
            <div className={styles.gradeVariaveis}>
              {METRICAS_CLIMA.map((metrica) => {
                const Icone = metrica.icone
                const marcado = metricasSelecionadas.includes(metrica.chave)
                return (
                  <button
                    key={metrica.chave}
                    type="button"
                    className={`${styles.opcaoVariavel} ${marcado ? styles.opcaoVariavelMarcada : ''}`}
                    onClick={() => alternarMetrica(metrica.chave)}
                    aria-pressed={marcado}
                  >
                    {marcado ? <CheckSquare size={16} /> : <Square size={16} />}
                    <Icone size={15} />
                    {metrica.titulo}
                  </button>
                )
              })}
            </div>
          </section>

          <section className={styles.secao}>
            <h2 className={styles.tituloSecao}>{t('exportacao.periodo')}</h2>
            <div className={styles.opcoesPeriodo}>
              {OPCOES_PERIODO.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  className={periodo === opcao.valor ? styles.pillAtiva : styles.pill}
                  onClick={() => setPeriodo(opcao.valor)}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.secao}>
            <h2 className={styles.tituloSecao}>{t('exportacao.formato')}</h2>
            <div className={styles.opcoesFormato}>
              {OPCOES_FORMATO.map((opcao) => {
                const Icone = opcao.icone
                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    className={formato === opcao.valor ? styles.formatoAtivo : styles.formatoCartao}
                    onClick={() => setFormato(opcao.valor)}
                    aria-pressed={formato === opcao.valor}
                  >
                    <Icone size={20} />
                    {t(`exportacao.${opcao.chave}`)}
                  </button>
                )
              })}
            </div>
          </section>

          {metricasSelecionadas.length === 0 && <p className={styles.aviso}>{t('exportacao.semVariaveis')}</p>}

          <button
            type="button"
            className={styles.botaoBaixar}
            onClick={aoClicarBaixar}
            disabled={metricasSelecionadas.length === 0 || gerando}
          >
            {gerando ? <Loader2 size={16} className={styles.girando} /> : <Download size={16} />}
            {t('exportacao.baixarArquivo')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ExportacaoDados
