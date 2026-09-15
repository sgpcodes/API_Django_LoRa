import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Thermometer, Droplets, Gauge, Wind, CloudRain, Calendar } from 'lucide-react'
import EstacaoCabecalho from '../components/EstacaoCabecalho'
import PrevisaoSemana from '../components/PrevisaoSemana'
import GradeGraficosMetricas from '../components/GradeGraficosMetricas'
import SummaryStatCard from '../components/SummaryStatCard'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual, derivarVisaoPeriodo, COORDENADAS_PADRAO } from '../services/climaExternoService'
import { buscarMinhaEstacaoPrincipal } from '../services/estacaoService'
import { tendenciaUltimaHora } from '../services/metricasClima'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard — página da estação (Tela 4 da especificação
// de fluxo, redesenhada: RF-15 a RF-22). Une o que antes eram duas telas
// separadas — o Dashboard e a aba "Clima INMET" (previsão de 5 dias por
// município) — numa página só: cabeçalho com identidade+mapa, tira de
// tempo real, previsão da semana + painel "Hoje", seletor de período único
// e os 5 gráficos lado a lado.
//
// O dado climático não vem mais da leitura bruta da ESP32 (ver histórico
// de climaEstacaoService.js, que hoje só sobrevive por causa de
// `direcaoTexto`, usado pelo painel do admin): a conta pediu pra tirar
// essa dependência — a ESP32 real só manda temperatura/umidade e fica
// intermitente, o que deixava pressão/vento/chuva sempre em "—" e o selo
// "Offline" contradizendo o resto da tela cheia de dado. Agora é tudo
// Open-Meteo (`buscarClimaAtual`), pra qualquer conta Standard, com ou sem
// estação atribuída — por isso a trava "aguardando estação" saiu daqui. O
// cadastro de Estação pelo admin continua existindo (ver EstacoesAdmin.jsx)
// só pra identidade/nome no cabeçalho, quando houver uma.
const INTERVALO_ATUALIZACAO_MS = 60_000

function Dashboard() {
  const { t, i18n } = useTranslation()
  const OPCOES_PERIODO_TRADUZIDAS = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
  ]
  const [estacao, setEstacao] = useState(null)
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')

  // Busca a cada 1 min: o clima (Open-Meteo, sempre) e, à parte, o nome da
  // estação atribuída — só pra identidade do cabeçalho, sem bloquear nada
  // se a conta não tiver uma. Trocar o período (Hoje/Ontem/7/30 dias) não
  // busca de novo, só filtra/agrupa o que já está em `clima` (ver
  // derivarVisaoPeriodo).
  useEffect(() => {
    async function carregar() {
      try {
        const dados = await buscarClimaAtual(COORDENADAS_PADRAO)
        setClima(dados)
        setErro(null)
      } catch {
        setErro(t('dashboard.erroBusca'))
      } finally {
        setCarregando(false)
      }
      buscarMinhaEstacaoPrincipal().then(setEstacao).catch(() => setEstacao(null))
    }

    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const visao = useMemo(() => (clima ? derivarVisaoPeriodo(clima, periodo) : null), [clima, periodo])

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto={t('dashboard.carregando')} />
      </div>
    )
  }

  if (erro || !clima) {
    return (
      <div className={styles.pagina}>
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

  return (
    <div className={styles.pagina}>
      <EstacaoCabecalho
        nome={estacao?.nome || estacao?.identificador || t('estacaoPagina.nomePadrao')}
        online={!erro}
        localizacaoTexto={estacao?.localizacao || t('estacaoPagina.localizacaoPadrao')}
        coordenadas={COORDENADAS_PADRAO}
      />

      <div className={styles.cardsPrincipais}>
        <SummaryStatCard
          icone={Thermometer}
          cor="var(--color-accent)"
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
          cor="var(--color-accent)"
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
          cor="var(--color-accent)"
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
          cor="var(--color-accent)"
          rotulo={t('dashboard.vento')}
          valor={resumoTopo.vento.velocidade != null ? `${resumoTopo.vento.velocidade} km/h` : '—'}
          legenda={`${resumoTopo.vento.direcaoTexto} · ${t('dashboard.rajadas')} ${resumoTopo.vento.rajada ?? '—'} km/h`}
          horarioAtualizacao={horarioUltimaLeitura}
          maxMin={{ maximo: resumoTopo.maxMin?.vento?.maximo, minimo: null, unidade: ' km/h' }}
        />
        <SummaryStatCard
          icone={CloudRain}
          cor="var(--color-accent)"
          rotulo={t('dashboard.chuva')}
          valor={resumoTopo.chuva != null ? `${resumoTopo.chuva} mm` : '—'}
          horarioAtualizacao={horarioUltimaLeitura}
          maxMin={{ ...resumoTopo.maxMin?.chuva, unidade: ' mm' }}
        />
      </div>

      <PrevisaoSemana clima={clima} />

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

      <GradeGraficosMetricas grafico={visao.grafico} resumoTopo={resumoTopo} />
    </div>
  )
}

export default Dashboard
