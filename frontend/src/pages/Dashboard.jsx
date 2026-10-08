import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Thermometer, Droplets, Droplet, Gauge, Wind, CloudRain, Cloud, Sun, Calendar } from 'lucide-react'
import EstacaoCabecalho from '../components/EstacaoCabecalho'
import PrevisaoSemana from '../components/PrevisaoSemana'
import GradeGraficosMetricas from '../components/GradeGraficosMetricas'
import SummaryStatCard from '../components/SummaryStatCard'
import StatusMessage from '../components/StatusMessage'
import PaginaEmBranco from '../components/PaginaEmBranco'
import { useMinhaEstacao } from '../hooks/useMinhaEstacao'
import { buscarLeituras } from '../services/leiturasService'
import { buscarClimaAtual, derivarVisaoPeriodo, montarClimaDeLeituras, dataISODeslocada } from '../services/climaExternoService'
import { tendenciaUltimaHora } from '../services/metricasClima'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard — página da estação (Tela 4 da especificação
// de fluxo, RF-15 a RF-22). Mostra os dados da ESTAÇÃO ATRIBUÍDA à conta
// pelo Gestor (física ou online — ver Estacao.tipo em api_rest/models.py),
// lidos do nosso próprio banco (Leitura), não mais ao vivo da Open-Meteo
// no navegador — isso é o que permite ver qualquer período (15/30/60+
// dias) sem depender da Open-Meteo estar no ar, e o que faz o backup
// local da Raspberry Pi funcionar de verdade (ver docs/rodando-na-
// raspberry.md). Sem estação atribuída, mostra aviso pedindo pro Gestor
// atribuir uma — não existe mais escolha livre de cidade aqui (isso saiu
// de propósito; ver histórico do projeto se precisar entender o antigo
// comportamento).
const INTERVALO_ATUALIZACAO_MS = 60_000

// Janela desde/até (datas "AAAA-MM-DD") que o período escolhido cobre —
// o próprio backend filtra por isso (LeituraListCreateView.get), em vez
// de buscar a tabela inteira e cortar no navegador.
function calcularJanela(periodo, rangePersonalizado) {
  if (periodo === 'hoje') return { desde: dataISODeslocada(0), ate: dataISODeslocada(0) }
  if (periodo === 'ontem') return { desde: dataISODeslocada(1), ate: dataISODeslocada(1) }
  if (periodo === 'personalizado') return { desde: rangePersonalizado.inicio, ate: rangePersonalizado.fim }
  return { desde: dataISODeslocada(periodo - 1), ate: dataISODeslocada(0) } // 7 ou 30
}

function Dashboard() {
  const { t, i18n } = useTranslation()
  const OPCOES_PERIODO_TRADUZIDAS = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
    { valor: 'personalizado', rotulo: t('dashboard.periodoPersonalizado') },
  ]
  // Sem teto técnico de 30 dias pra trás (diferente da Open-Meteo ao vivo):
  // o histórico é nosso agora, cresce sem parar. Só um limite generoso pra
  // não deixar escolher uma data absurda; "até" não passa de hoje, já que
  // isto não é mais previsão, é leitura real já registrada.
  const DATA_MINIMA_PERSONALIZADA = dataISODeslocada(730)
  const DATA_MAXIMA_PERSONALIZADA = dataISODeslocada(0)
  const ABAS = [
    { valor: 'elementos', rotulo: t('dashboard.abaElementos'), icone: Thermometer },
    { valor: 'previsao', rotulo: t('dashboard.abaPrevisao'), icone: Cloud },
    { valor: 'balanco', rotulo: t('dashboard.abaBalancoHidrico'), icone: Droplet },
  ]

  const { estacao, carregando: carregandoEstacao } = useMinhaEstacao()
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')
  const [rangePersonalizado, setRangePersonalizado] = useState({ inicio: dataISODeslocada(0), fim: dataISODeslocada(0) })
  const [abaAtiva, setAbaAtiva] = useState('elementos')
  const [climaPrevisao, setClimaPrevisao] = useState(null)
  const [erroPrevisao, setErroPrevisao] = useState(null)

  // Busca as Leituras já salvas da estação atribuída, pra janela do
  // período escolhido — a cada 1 min, pra acompanhar a coleta automática
  // (coletar_dados_online, a cada ~10 min) sem precisar recarregar a
  // página. Troca de período/estação refaz na hora.
  useEffect(() => {
    if (!estacao) return
    let cancelado = false
    setCarregando(true)

    async function carregar() {
      try {
        const { desde, ate } = calcularJanela(periodo, rangePersonalizado)
        const leituras = await buscarLeituras({ sensorId: estacao.identificador, desde, ate })
        if (!cancelado) {
          setClima(montarClimaDeLeituras(leituras))
          setErro(null)
        }
      } catch {
        if (!cancelado) setErro(t('dashboard.erroBusca'))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estacao, periodo, rangePersonalizado])

  // Previsão só existe pra estação online (dado futuro não existe pra
  // hardware físico) — busca ao vivo na Open-Meteo com a coordenada
  // salva da estação, só quando a aba é aberta (não vale a pena buscar
  // isso toda hora se ninguém olha pra aba).
  useEffect(() => {
    if (abaAtiva !== 'previsao' || estacao?.tipo !== 'online' || climaPrevisao) return
    let cancelado = false
    buscarClimaAtual({ latitude: estacao.latitude, longitude: estacao.longitude })
      .then((dados) => {
        if (!cancelado) setClimaPrevisao(dados)
      })
      .catch(() => {
        if (!cancelado) setErroPrevisao(t('dashboard.erroBusca'))
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva, estacao])

  const visao = useMemo(
    () => (clima ? derivarVisaoPeriodo(clima, periodo, rangePersonalizado) : null),
    [clima, periodo, rangePersonalizado],
  )

  if (carregandoEstacao) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto={t('dashboard.carregando')} />
      </div>
    )
  }

  if (!estacao) {
    return (
      <div className={styles.pagina}>
        <PaginaEmBranco icone={Thermometer} titulo={t('dashboard.semEstacaoTitulo')} mensagem={t('dashboard.semEstacaoTexto')} />
      </div>
    )
  }

  const cabecalho = <EstacaoCabecalho estacao={estacao} />

  if (carregando) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={t('dashboard.carregando')} />
      </div>
    )
  }

  if (erro || !clima) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto={erro ?? t('dashboard.erroBusca')} />
      </div>
    )
  }

  const { resumoTopo } = visao
  const horarioUltimaLeitura = clima.atualizadoEm
    ? new Date(clima.atualizadoEm).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const tendenciaTemperatura = tendenciaUltimaHora(clima.horaria.temperatura)
  const tendenciaUmidade = tendenciaUltimaHora(clima.horaria.umidade)
  const tendenciaPressao = tendenciaUltimaHora(clima.horaria.pressao)
  const tendenciaRadiacao = tendenciaUltimaHora(clima.horaria.radiacao)

  return (
    <div className={styles.pagina}>
      <div className={styles.abas}>
        {ABAS.map((aba) => {
          const Icone = aba.icone
          return (
            <button
              key={aba.valor}
              type="button"
              className={`${styles.aba} ${abaAtiva === aba.valor ? styles.abaAtiva : ''}`}
              onClick={() => setAbaAtiva(aba.valor)}
            >
              <Icone size={15} />
              {aba.rotulo}
            </button>
          )
        })}
      </div>

      {abaAtiva === 'previsao' && estacao.tipo !== 'online' && <StatusMessage texto={t('dashboard.previsaoIndisponivelFisica')} />}
      {abaAtiva === 'previsao' && estacao.tipo === 'online' && climaPrevisao && (
        <PrevisaoSemana clima={climaPrevisao} cidade={estacao.nome} coordenadas={{ latitude: estacao.latitude, longitude: estacao.longitude }} />
      )}
      {abaAtiva === 'previsao' && estacao.tipo === 'online' && !climaPrevisao && (
        <StatusMessage texto={erroPrevisao ?? t('dashboard.carregando')} />
      )}

      {abaAtiva === 'balanco' && <PaginaEmBranco icone={Droplet} titulo={t('dashboard.abaBalancoHidrico')} />}

      {abaAtiva === 'elementos' && (
        <>
          {cabecalho}

          <div className={styles.cardsPrincipais}>
            <SummaryStatCard
              icone={Thermometer}
              cor="var(--metrica-temperatura)"
              rotulo={t('dashboard.temperatura')}
              valor={resumoTopo.temperatura != null ? `${resumoTopo.temperatura}°C` : '—'}
              legenda={
                tendenciaTemperatura.delta == null
                  ? undefined
                  : t('dashboard.ultimaHoraTemperatura', { valor: Math.abs(tendenciaTemperatura.delta) })
              }
              tendencia={tendenciaTemperatura.tendencia}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ ...resumoTopo.maxMin?.temperatura, unidade: '°C' }}
            />
            <SummaryStatCard
              icone={Droplets}
              cor="var(--metrica-umidade)"
              rotulo={t('dashboard.umidade')}
              valor={resumoTopo.umidade != null ? `${resumoTopo.umidade}%` : '—'}
              legenda={
                tendenciaUmidade.delta == null ? undefined : t('dashboard.ultimaHoraUmidade', { valor: Math.abs(tendenciaUmidade.delta) })
              }
              tendencia={tendenciaUmidade.tendencia}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ ...resumoTopo.maxMin?.umidade, unidade: '%' }}
            />
            <SummaryStatCard
              icone={Gauge}
              cor="var(--metrica-pressao)"
              rotulo={t('dashboard.pressao')}
              valor={resumoTopo.pressao != null ? `${resumoTopo.pressao} hPa` : '—'}
              legenda={
                tendenciaPressao.delta == null ? undefined : t('dashboard.ultimaHoraPressao', { valor: Math.abs(tendenciaPressao.delta) })
              }
              tendencia={tendenciaPressao.tendencia}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ ...resumoTopo.maxMin?.pressao, unidade: ' hPa' }}
            />
            <SummaryStatCard
              icone={Wind}
              cor="var(--metrica-vento)"
              rotulo={t('dashboard.vento')}
              valor={resumoTopo.vento.velocidade != null ? `${resumoTopo.vento.velocidade} km/h` : '—'}
              legenda={`${resumoTopo.vento.direcaoTexto} · ${t('dashboard.rajadas')} ${resumoTopo.vento.rajada ?? '—'} km/h`}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ maximo: resumoTopo.maxMin?.vento?.maximo, minimo: null, unidade: ' km/h' }}
            />
            <SummaryStatCard
              icone={CloudRain}
              cor="var(--metrica-chuva)"
              rotulo={t('dashboard.chuva')}
              valor={resumoTopo.chuva != null ? `${resumoTopo.chuva} mm` : '—'}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ ...resumoTopo.maxMin?.chuva, unidade: ' mm' }}
            />
            <SummaryStatCard
              icone={Sun}
              cor="var(--metrica-radiacao)"
              rotulo={t('dashboard.radiacao')}
              valor={resumoTopo.radiacao != null ? `${resumoTopo.radiacao} W/m²` : '—'}
              legenda={
                tendenciaRadiacao.delta == null ? undefined : t('dashboard.ultimaHoraRadiacao', { valor: Math.abs(tendenciaRadiacao.delta) })
              }
              tendencia={tendenciaRadiacao.tendencia}
              horarioAtualizacao={horarioUltimaLeitura}
              maxMin={{ ...resumoTopo.maxMin?.radiacao, unidade: ' W/m²' }}
            />
          </div>

          <div className={styles.seletorPeriodoTopo}>
            <span className={styles.seletorPeriodoRotulo}>
              <Calendar size={14} />
              {t('dashboard.periodoLabel')}
            </span>
            <div className={styles.seletorPeriodoOpcoes}>
              {OPCOES_PERIODO_TRADUZIDAS.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  className={`${styles.botaoPeriodoTopo} ${periodo === opcao.valor ? styles.botaoPeriodoTopoAtivo : ''}`}
                  onClick={() => setPeriodo(opcao.valor)}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>

            {periodo === 'personalizado' && (
              <div className={styles.rangePersonalizado}>
                <label className={styles.campoData}>
                  {t('dashboard.personalizadoDe')}
                  <input
                    type="date"
                    value={rangePersonalizado.inicio}
                    min={DATA_MINIMA_PERSONALIZADA}
                    max={rangePersonalizado.fim}
                    onChange={(evento) => setRangePersonalizado((atual) => ({ ...atual, inicio: evento.target.value }))}
                  />
                </label>
                <label className={styles.campoData}>
                  {t('dashboard.personalizadoAte')}
                  <input
                    type="date"
                    value={rangePersonalizado.fim}
                    min={rangePersonalizado.inicio}
                    max={DATA_MAXIMA_PERSONALIZADA}
                    onChange={(evento) => setRangePersonalizado((atual) => ({ ...atual, fim: evento.target.value }))}
                  />
                </label>
              </div>
            )}
          </div>

          <GradeGraficosMetricas clima={clima} periodoGlobal={periodo} rangePersonalizadoGlobal={rangePersonalizado} />
        </>
      )}
    </div>
  )
}

export default Dashboard
