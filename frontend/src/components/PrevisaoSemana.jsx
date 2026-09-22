import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Droplets, Sunrise, Sunset, Eye, Gauge, Wind, ChevronDown } from 'lucide-react'
import { descricaoTempo } from '../services/climaExternoService'
import iconeSol from '../assets/clima/sol.png'
import iconeNublado from '../assets/clima/nublado.png'
import iconeParcialmenteNublado from '../assets/clima/parcialmente-nublado.png'
import iconeChuva from '../assets/clima/chuva.png'
import iconeNoite from '../assets/clima/noite.png'
import styles from './PrevisaoSemana.module.css'

// Ícones "bonitos" (assets/clima/*.png, recortados e com fundo removido de
// icones_clima.png) em vez do lucide-react genérico — pedido explícito. O
// material não tem um ícone de tempestade separado, então tempestade
// reaproveita o de chuva (mesma decisão que o backend já toma pra
// condição, ver clima_externo/views.py).
const IMAGEM_CONDICAO = {
  sol: iconeSol,
  nublado: iconeNublado,
  'parcialmente-nublado': iconeParcialmenteNublado,
  chuva: iconeChuva,
  tempestade: iconeChuva,
  noite: iconeNoite,
}

const ABREVIACAO_DIA_SEMANA = {
  domingo: 'Dom', 'segunda-feira': 'Seg', 'terca-feira': 'Ter', 'quarta-feira': 'Qua',
  'quinta-feira': 'Qui', 'sexta-feira': 'Sex', sabado: 'Sáb',
}

function normalizarTexto(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function abreviarDiaSemana(diaSemana) {
  const chave = normalizarTexto(diaSemana).replace(/\s+/g, '-')
  return ABREVIACAO_DIA_SEMANA[chave] ?? diaSemana
}

function formatarDataCurta(dataISO) {
  return dataISO ? `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}` : '—'
}

function formatarHora(horaISO) {
  if (!horaISO) return '—'
  return new Date(horaISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Sol à noite não faz sentido visualmente — troca pelo ícone de lua fora do
// horário aproximado de dia (06h-18h), só pra condição "sol"/céu limpo;
// as outras condições (nuvem, chuva...) valem de dia ou de noite.
function iconeParaHora(condicao, dataHoraISO) {
  // só considera noite quando `dataHoraISO` tem hora de verdade (formato
  // "AAAA-MM-DDTHH:mm", 16+ caracteres) — os cards de dia passam só a data
  // ("AAAA-MM-DD", 10 caracteres), que não tem hora pra checar.
  if (condicao === 'sol' && dataHoraISO?.length > 10) {
    const hora = Number(dataHoraISO.slice(11, 13))
    if (hora < 6 || hora >= 18) return IMAGEM_CONDICAO.noite
  }
  return IMAGEM_CONDICAO[condicao] ?? IMAGEM_CONDICAO.sol
}

// Previsão de 15 dias (RF-21, Open-Meteo — o INMET só cobre 5) + painel
// "Hoje" com o que só o Open-Meteo tem (ponto de orvalho, UV, visibilidade,
// nascer/pôr do sol). Clicar num dia expande um painel hora a hora embaixo
// dele (pedido explícito) — vem de `clima.previsaoHoraria`, casado pela
// data (AAAA-MM-DD) contra `clima.previsaoDiaria[i].data`, os dois já
// vêm do mesmo provedor então o formato bate direto, sem parse frágil.
function PrevisaoSemana({ clima, cidade }) {
  const { t } = useTranslation()
  const [diaExpandidoIndice, setDiaExpandidoIndice] = useState(null)

  const dias = clima?.previsaoDiaria ?? []
  const diaHoje = dias[0] ?? null
  const iconeHoje = diaHoje ? iconeParaHora(diaHoje.condicao, clima?.atualizadoEm) : IMAGEM_CONDICAO.sol

  const diaExpandido = diaExpandidoIndice != null ? dias[diaExpandidoIndice] : null
  const horasDoDiaExpandido = useMemo(() => {
    if (!diaExpandido) return []
    const agora = new Date()
    return (clima?.previsaoHoraria ?? []).filter(
      (ponto) => ponto.data === diaExpandido.data && new Date(ponto.dataHora) >= agora,
    )
  }, [clima, diaExpandido])

  function aoClicarDia(indice) {
    setDiaExpandidoIndice((atual) => (atual === indice ? null : indice))
  }

  return (
    <div className={styles.container}>
      <div className={styles.blocoSemana}>
        <div className={styles.cabecalhoPrevisao}>
          <span className={styles.iconeCabecalho}>
            <img src={iconeHoje} alt="" className={styles.imagemIconeGrande} />
          </span>
          <div>
            <h2 className={styles.titulo}>
              {t('estacaoPagina.previsaoTitulo')}
              {cidade && ` — ${cidade}`}
            </h2>
            <p className={styles.subtitulo}>{t('estacaoPagina.previsaoSubtitulo')}</p>
          </div>
        </div>

        {dias.length === 0 ? (
          <p className={styles.vazio}>{t('estacaoPagina.previsaoIndisponivel')}</p>
        ) : (
          <div className={styles.diasSemana}>
            {dias.map((dia, indice) => (
              <button
                key={dia.data}
                type="button"
                className={`${styles.diaCard} ${diaExpandidoIndice === indice ? styles.diaCardAtivo : ''}`}
                onClick={() => aoClicarDia(indice)}
                aria-expanded={diaExpandidoIndice === indice}
              >
                <span className={styles.diaCardNome}>
                  {indice === 0 ? t('dashboard.periodoHoje') : abreviarDiaSemana(dia.diaSemana)}
                </span>
                <span className={styles.diaCardData}>{formatarDataCurta(dia.data)}</span>
                <img src={iconeParaHora(dia.condicao, dia.data)} alt={descricaoTempo(dia.weatherCode)} className={styles.diaCardIcone} />
                <span className={styles.diaCardTemp}>
                  {Math.round(dia.tempMin)}° / {Math.round(dia.tempMax)}°
                </span>
                <span className={styles.diaCardResumo}>{descricaoTempo(dia.weatherCode)}</span>
                <span className={styles.diaCardMetrica}>
                  <Droplets size={12} /> {dia.chuvaProbabilidade != null ? `${dia.chuvaProbabilidade}%` : '—'}
                </span>
                <span className={styles.diaCardMetrica}>
                  <Wind size={12} /> {dia.ventoDirecaoTexto} {dia.ventoIntensidade}
                </span>
                <ChevronDown size={14} className={`${styles.diaCardSeta} ${diaExpandidoIndice === indice ? styles.diaCardSetaAberta : ''}`} />
              </button>
            ))}
          </div>
        )}

        {diaExpandido && (
          <div className={styles.painelHoras}>
            <h3 className={styles.painelHorasTitulo}>
              {t('estacaoPagina.previsaoPorHora')} — {diaExpandidoIndice === 0 ? t('dashboard.periodoHoje') : abreviarDiaSemana(diaExpandido.diaSemana)}, {formatarDataCurta(diaExpandido.data)}
            </h3>
            {horasDoDiaExpandido.length === 0 ? (
              <p className={styles.vazio}>{t('estacaoPagina.previsaoIndisponivel')}</p>
            ) : (
              <div className={styles.horas}>
                {horasDoDiaExpandido.map((ponto) => (
                  <div key={ponto.dataHora} className={styles.horaCard}>
                    <span className={styles.horaRotulo}>{ponto.hora}</span>
                    <img src={iconeParaHora(ponto.condicao, ponto.dataHora)} alt="" className={styles.horaIcone} />
                    <span className={styles.horaTemp}>{Math.round(ponto.temperatura)}°</span>
                    <span className={styles.horaChuva}>
                      <Droplets size={11} /> {ponto.chuvaProbabilidade != null ? `${ponto.chuvaProbabilidade}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.painelHoje}>
        <h3 className={styles.painelTitulo}>{t('dashboard.periodoHoje')}</h3>
        <ul className={styles.listaDetalhes}>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Gauge size={14} /> {t('dashboard.temperatura')}
            </span>
            <span className={styles.valorDetalhe}>{diaHoje ? `${Math.round(diaHoje.tempMin)}° / ${Math.round(diaHoje.tempMax)}°C` : '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Droplets size={14} /> {t('estacaoPagina.pontoOrvalho')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.pontoDeOrvalho != null ? `${clima.pontoDeOrvalho}°C` : '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Gauge size={14} /> {t('estacaoPagina.indiceUV')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.indiceUV ?? '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Droplets size={14} /> {t('estacaoPagina.precipitacao24h')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.precipitacao != null ? `${clima.precipitacao} mm` : '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Eye size={14} /> {t('estacaoPagina.visibilidade')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.visibilidadeKm != null ? `${clima.visibilidadeKm} km` : '—'}</span>
          </li>
        </ul>

        <div className={styles.blocoSol}>
          <div className={styles.itemSol}>
            <Sunrise size={16} />
            <div>
              <span className={styles.rotuloSol}>{t('estacaoPagina.nascerSol')}</span>
              <span className={styles.valorSol}>{formatarHora(clima?.nascerSol)}</span>
            </div>
          </div>
          <div className={styles.itemSol}>
            <Sunset size={16} />
            <div>
              <span className={styles.rotuloSol}>{t('estacaoPagina.porSol')}</span>
              <span className={styles.valorSol}>{formatarHora(clima?.porSol)}</span>
            </div>
          </div>
        </div>

        <div className={styles.condicaoAtual}>
          <img src={iconeHoje} alt="" className={styles.imagemIconePequena} />
          <div>
            <span className={styles.rotuloSol}>{t('estacaoPagina.condicaoAtual')}</span>
            <span className={styles.valorSol}>{clima?.condicaoTexto ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrevisaoSemana
