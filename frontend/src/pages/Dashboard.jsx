import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Thermometer, Droplets, Gauge, Wind, CloudRain, Sun, Calendar } from 'lucide-react'
import EstacaoCabecalho from '../components/EstacaoCabecalho'
import PrevisaoSemana from '../components/PrevisaoSemana'
import GradeGraficosMetricas from '../components/GradeGraficosMetricas'
import SummaryStatCard from '../components/SummaryStatCard'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual, derivarVisaoPeriodo } from '../services/climaExternoService'
import { UFS, buscarMunicipiosPorUf } from '../services/ibgeService'
import { geocodificarCidade } from '../services/geocodingService'
import { tendenciaUltimaHora } from '../services/metricasClima'
import { CHAVE_UF_SELECIONADA, CHAVE_CIDADE_SELECIONADA, obterLocalizacaoSelecionada } from '../services/localizacaoSelecionada'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard — página da estação (Tela 4 da especificação
// de fluxo, redesenhada: RF-15 a RF-22). Une o que antes eram duas telas
// separadas — o Dashboard e a aba "Clima INMET" (previsão de 5 dias por
// município) — numa página só: cabeçalho com seletor de Estado/Cidade
// (catálogo do IBGE) + mapa, tira de tempo real, previsão da semana +
// painel "Hoje", seletor de período único e os 5 gráficos lado a lado.
//
// Não existe "estação" nem nome fictício aqui: o Open-Meteo não tem
// estação nenhuma, só responde clima por coordenada (ver conversa no
// parecer) — então a identidade da página é a própria cidade escolhida.
// A coordenada dessa cidade é resolvida na hora via geocodingService.js
// (mesmo provedor do clima); o INMET usa o código de município que o
// próprio IBGE já devolve na lista. Também não depende mais de leitura
// bruta da ESP32 (intermitente, só manda temperatura/umidade) nem de
// estação atribuída pelo admin, e não tem bloqueio por plano ainda —
// qualquer conta Standard pode escolher qualquer cidade do Brasil (fica
// pra quando existir cadastro de estação virtual de verdade, RF-03).
const INTERVALO_ATUALIZACAO_MS = 60_000

function Dashboard() {
  const { t, i18n } = useTranslation()
  const OPCOES_PERIODO_TRADUZIDAS = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
  ]
  const localizacaoInicial = obterLocalizacaoSelecionada()
  const [uf, setUf] = useState(localizacaoInicial.uf)
  const [cidade, setCidade] = useState(localizacaoInicial.cidade)
  const [municipios, setMunicipios] = useState([])
  const [coordenadas, setCoordenadas] = useState(null)
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(true)
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')

  // Troca de estado: busca a lista de municípios dele (IBGE). Se a cidade
  // atual não existir nessa lista (trocou de estado, ou é a carga inicial
  // e "Maricá" não existe no estado escolhido), cai na primeira da lista.
  useEffect(() => {
    let cancelado = false
    buscarMunicipiosPorUf(uf)
      .then((lista) => {
        if (cancelado) return
        setMunicipios(lista)
        if (!lista.some((m) => m.nome === cidade)) {
          setCidade(lista[0]?.nome ?? '')
        }
      })
      .catch(() => {
        if (!cancelado) setMunicipios([])
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uf])

  // Troca de cidade: geocodifica pra ter uma coordenada de verdade —
  // o IBGE não dá latitude/longitude, só nome/código (ver geocodingService.js).
  useEffect(() => {
    if (!cidade) return
    let cancelado = false
    setCarregandoLocalizacao(true)
    geocodificarCidade(cidade, uf)
      .then((coords) => {
        if (!cancelado) setCoordenadas(coords)
      })
      .catch(() => {
        if (!cancelado) {
          setCoordenadas(null)
          setErro(t('dashboard.erroBusca'))
        }
      })
      .finally(() => {
        if (!cancelado) setCarregandoLocalizacao(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidade, uf])

  // Busca o clima (Open-Meteo) pra coordenada já resolvida, a cada 1 min —
  // troca de cidade refaz na hora, sem esperar o próximo ciclo.
  useEffect(() => {
    if (!coordenadas) return
    let cancelado = false
    setCarregando(true)

    async function carregar() {
      try {
        const dados = await buscarClimaAtual(coordenadas)
        if (!cancelado) {
          setClima(dados)
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
  }, [coordenadas])

  function aoMudarUf(novaUf) {
    setUf(novaUf)
    localStorage.setItem(CHAVE_UF_SELECIONADA, novaUf)
  }

  function aoMudarCidade(novaCidade) {
    setCidade(novaCidade)
    localStorage.setItem(CHAVE_CIDADE_SELECIONADA, novaCidade)
  }

  const visao = useMemo(() => (clima ? derivarVisaoPeriodo(clima, periodo) : null), [clima, periodo])

  const cabecalho = (
    <EstacaoCabecalho
      cidade={cidade}
      uf={uf}
      online={!erro}
      coordenadas={coordenadas}
      carregandoLocalizacao={carregandoLocalizacao}
      ufs={UFS}
      municipios={municipios}
      onMudarUf={aoMudarUf}
      onMudarCidade={aoMudarCidade}
    />
  )

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

      <PrevisaoSemana clima={clima} cidade={cidade} coordenadas={coordenadas} />

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
      </div>

      <GradeGraficosMetricas clima={clima} periodoGlobal={periodo} />
    </div>
  )
}

export default Dashboard
