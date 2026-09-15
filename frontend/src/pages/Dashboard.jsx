import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Thermometer, Droplets, Gauge, Wind, CloudRain, Calendar } from 'lucide-react'
import EstacaoCabecalho from '../components/EstacaoCabecalho'
import PrevisaoSemana from '../components/PrevisaoSemana'
import GradeGraficosMetricas from '../components/GradeGraficosMetricas'
import SummaryStatCard from '../components/SummaryStatCard'
import StatusMessage from '../components/StatusMessage'
import { buscarClimaAtual, derivarVisaoPeriodo } from '../services/climaExternoService'
import { ESTACOES_VIRTUAIS, buscarEstacaoVirtual } from '../services/estacoesVirtuais'
import { tendenciaUltimaHora } from '../services/metricasClima'
import styles from './Dashboard.module.css'

// Dashboard da conta Standard — página da estação (Tela 4 da especificação
// de fluxo, redesenhada: RF-15 a RF-22). Une o que antes eram duas telas
// separadas — o Dashboard e a aba "Clima INMET" (previsão de 5 dias por
// município) — numa página só: cabeçalho com identidade+mapa+seletor de
// estação, tira de tempo real, previsão da semana + painel "Hoje", seletor
// de período único e os 5 gráficos lado a lado.
//
// Piloto de estações virtuais (RF-11/RF-13): a conta escolhe entre as 5
// estações fixas de services/estacoesVirtuais.js, cada uma com sua própria
// coordenada — o clima (Open-Meteo) e a previsão do INMET são buscados de
// novo pra localidade escolhida. Não depende mais de leitura bruta da
// ESP32 (a real fica intermitente e só manda temperatura/umidade, o que
// deixava pressão/vento/chuva sempre em "—") nem de estação atribuída pelo
// admin — qualquer conta Standard vê as 5, sem bloqueio por plano ainda
// (fica pra quando o cadastro de estação virtual virar de verdade, RF-03).
const INTERVALO_ATUALIZACAO_MS = 60_000
const CHAVE_ESTACAO_SELECIONADA = 'lacop:estacaoVirtualSelecionada'

function Dashboard() {
  const { t, i18n } = useTranslation()
  const OPCOES_PERIODO_TRADUZIDAS = [
    { valor: 'hoje', rotulo: t('dashboard.periodoHoje') },
    { valor: 'ontem', rotulo: t('dashboard.periodoOntem') },
    { valor: 7, rotulo: t('dashboard.periodo7dias') },
    { valor: 30, rotulo: t('dashboard.periodo30dias') },
  ]
  const [estacaoVirtualId, setEstacaoVirtualId] = useState(
    () => localStorage.getItem(CHAVE_ESTACAO_SELECIONADA) ?? ESTACOES_VIRTUAIS[0].id,
  )
  const estacaoVirtual = buscarEstacaoVirtual(estacaoVirtualId)
  const [clima, setClima] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState('hoje')

  // Busca a cada 1 min o clima (Open-Meteo) da estação virtual escolhida —
  // troca de estação refaz a busca na hora, sem esperar o próximo ciclo.
  // Trocar o período (Hoje/Ontem/7/30 dias) não busca de novo, só
  // filtra/agrupa o que já está em `clima` (ver derivarVisaoPeriodo).
  useEffect(() => {
    let cancelado = false
    setCarregando(true)

    async function carregar() {
      try {
        const dados = await buscarClimaAtual({ latitude: estacaoVirtual.latitude, longitude: estacaoVirtual.longitude })
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
  }, [estacaoVirtual.id])

  function aoMudarEstacao(id) {
    setEstacaoVirtualId(id)
    localStorage.setItem(CHAVE_ESTACAO_SELECIONADA, id)
  }

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
        nome={estacaoVirtual.nome}
        online={!erro}
        localizacaoTexto={`${estacaoVirtual.cidade} - ${estacaoVirtual.uf}`}
        coordenadas={{ latitude: estacaoVirtual.latitude, longitude: estacaoVirtual.longitude }}
        opcoesEstacao={ESTACOES_VIRTUAIS}
        estacaoSelecionadaId={estacaoVirtual.id}
        onMudarEstacao={aoMudarEstacao}
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

      <PrevisaoSemana clima={clima} uf={estacaoVirtual.uf} cidade={estacaoVirtual.cidade} />

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
