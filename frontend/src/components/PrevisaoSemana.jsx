import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Cloud, CloudRain, CloudLightning, CloudSun, Wind, Droplets, Sunrise, Sunset, Eye, Gauge } from 'lucide-react'
import StatusMessage from './StatusMessage'
import { buscarMeuPerfil } from '../services/perfilService'
import { buscarPrevisaoInmet } from '../services/inmetService'
import { buscarMunicipiosPorUf } from '../services/ibgeService'
import styles from './PrevisaoSemana.module.css'

const ICONE_CONDICAO = {
  sol: Sun,
  nublado: Cloud,
  'parcialmente-nublado': CloudSun,
  chuva: CloudRain,
  tempestade: CloudLightning,
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

function formatarDataCurta(data) {
  const [mes, dia] = (data ?? '').split('/')
  return dia && mes ? `${dia}/${mes}` : data
}

// Reduz um dia da previsão do INMET (pode vir dividido em manhã/tarde/
// noite, ou como resumo único) a um só objeto pro card compacto — mesma
// lógica que existia em ClimaInmet.jsx.
function resumirDia(dia) {
  if (dia.dia_inteiro) return dia.dia_inteiro
  const periodos = [dia.manha, dia.tarde, dia.noite].filter(Boolean)
  if (periodos.length === 0) return null
  const base = dia.tarde ?? periodos[0]
  return {
    resumo: base.resumo,
    condicao: base.condicao,
    dir_vento: base.dir_vento,
    int_vento: base.int_vento,
    temp_max: Math.max(...periodos.map((p) => p.temp_max)),
    temp_min: Math.min(...periodos.map((p) => p.temp_min)),
    umidade_max: Math.max(...periodos.map((p) => p.umidade_max)),
    umidade_min: Math.min(...periodos.map((p) => p.umidade_min)),
  }
}

function formatarHora(horaISO) {
  if (!horaISO) return '—'
  return new Date(horaISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Previsão de 5 dias (INMET, por município) + painel "Hoje" com o que o
// INMET não tem (ponto de orvalho, UV, visibilidade, nascer/pôr do sol —
// tudo isso vem de `clima`, a mesma fonte que já alimenta a tira de tempo
// real e os gráficos). É a fusão pedida entre o Dashboard e a aba Clima
// INMET — sem seletor de Estado/Município visível: resolve sozinho a
// partir da cidade/estado do perfil da conta, igual o antigo ClimaInmet.jsx
// já fazia por trás do seletor.
function PrevisaoSemana({ clima }) {
  const { t } = useTranslation()
  const [previsao, setPrevisao] = useState(null)
  const [nomeMunicipio, setNomeMunicipio] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [diaSelecionadoIndice, setDiaSelecionadoIndice] = useState(0)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      try {
        const perfil = await buscarMeuPerfil()
        const uf = (perfil?.estado || 'RJ').toUpperCase()
        const municipios = await buscarMunicipiosPorUf(uf)
        if (municipios.length === 0) throw new Error('sem municípios')

        const cidade = normalizarTexto(perfil?.cidade)
        const municipio = municipios.find((m) => normalizarTexto(m.nome) === cidade) ?? municipios[0]
        const dados = await buscarPrevisaoInmet(municipio.codigo)

        if (!cancelado) {
          setPrevisao(dados)
          setNomeMunicipio(municipio.nome)
          setErro(null)
        }
      } catch {
        if (!cancelado) setErro(t('estacaoPagina.previsaoIndisponivel'))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const diaHoje = useMemo(() => (previsao?.dias?.[0] ? resumirDia(previsao.dias[0]) : null), [previsao])

  return (
    <div className={styles.container}>
      <div className={styles.blocoSemana}>
        <h2 className={styles.titulo}>
          <CloudSun size={17} />
          {t('estacaoPagina.previsaoTitulo')}
          {nomeMunicipio && ` — ${nomeMunicipio}`}
        </h2>

        {carregando ? (
          <StatusMessage texto={t('estacaoPagina.carregandoPrevisao')} />
        ) : erro || !previsao || previsao.dias.length === 0 ? (
          <p className={styles.vazio}>{erro ?? t('estacaoPagina.previsaoIndisponivel')}</p>
        ) : (
          <div className={styles.diasSemana}>
            {previsao.dias.map((dia, indice) => {
              const resumo = resumirDia(dia)
              if (!resumo) return null
              const Icone = ICONE_CONDICAO[resumo.condicao] ?? Sun
              return (
                <button
                  key={dia.data}
                  type="button"
                  className={`${styles.diaCard} ${indice === diaSelecionadoIndice ? styles.diaCardAtivo : ''}`}
                  onClick={() => setDiaSelecionadoIndice(indice)}
                >
                  <span className={styles.diaCardNome}>
                    {indice === 0 ? t('dashboard.periodoHoje') : abreviarDiaSemana(dia.dia_semana)}
                  </span>
                  <span className={styles.diaCardData}>{formatarDataCurta(dia.data)}</span>
                  <Icone size={28} className={styles.diaCardIcone} />
                  <span className={styles.diaCardTemp}>
                    {resumo.temp_min}° / {resumo.temp_max}°
                  </span>
                  <span className={styles.diaCardResumo}>{resumo.resumo}</span>
                  <span className={styles.diaCardMetrica}>
                    <Droplets size={11} /> {resumo.umidade_min}–{resumo.umidade_max}%
                  </span>
                  <span className={styles.diaCardMetrica}>
                    <Wind size={11} /> {resumo.dir_vento} {resumo.int_vento}
                  </span>
                </button>
              )
            })}
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
            <span className={styles.valorDetalhe}>{diaHoje ? `${diaHoje.temp_min}° / ${diaHoje.temp_max}°C` : '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Droplets size={14} /> {t('estacaoPagina.pontoOrvalho')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.pontoDeOrvalho != null ? `${clima.pontoDeOrvalho}°C` : '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <Sun size={14} /> {t('estacaoPagina.indiceUV')}
            </span>
            <span className={styles.valorDetalhe}>{clima?.indiceUV ?? '—'}</span>
          </li>
          <li>
            <span className={styles.rotuloDetalhe}>
              <CloudRain size={14} /> {t('estacaoPagina.precipitacao24h')}
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
          <CloudSun size={20} />
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
