import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapPin,
  Landmark,
  AlertTriangle,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSun,
  Wind,
  Droplets,
} from 'lucide-react'
import CabecalhoStandard from '../components/CabecalhoStandard'
import StatusMessage from '../components/StatusMessage'
import { buscarMeuPerfil } from '../services/perfilService'
import { buscarEstacoesInmet, buscarPrevisaoInmet, buscarAvisosInmet } from '../services/inmetService'
import { buscarMunicipiosPorUf } from '../services/ibgeService'
import styles from './ClimaInmet.module.css'

// Aba "Clima INMET" (Standard) — dado público oficial do Instituto
// Nacional de Meteorologia, via o proxy do backend (clima_externo).
// Totalmente separada do Dashboard (dado da própria estação ESP32): não
// reaproveita nenhum dado, componente ou rota de lá.
//
// O endpoint de leituras horárias por estação está bloqueado por
// bot-defense do INMET (ver clima_externo/views.py) — por isso a
// "Estação de referência" abaixo mostra só identificação/localização/
// status, sem valor de leitura ao vivo, em vez de fingir um dado que a
// API não consegue mais entregar.

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const ICONE_CONDICAO = {
  sol: Sun,
  nublado: Cloud,
  'parcialmente-nublado': CloudSun,
  chuva: CloudRain,
  tempestade: CloudLightning,
}

const NOMES_DIA = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

function normalizarTexto(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function CardVazio({ texto }) {
  return <p className={styles.vazio}>{texto}</p>
}

function PeriodoPrevisao({ nome, dados }) {
  if (!dados) return null
  const Icone = ICONE_CONDICAO[dados.condicao] ?? Sun
  return (
    <div className={styles.periodo}>
      <div className={styles.periodoCabecalho}>
        <Icone size={20} className={styles.periodoIcone} />
        <span className={styles.periodoNome}>{nome}</span>
      </div>
      <p className={styles.periodoResumo}>{dados.resumo}</p>
      <div className={styles.periodoMetricas}>
        <span>{dados.temp_min}° – {dados.temp_max}°C</span>
        <span><Droplets size={13} /> {dados.umidade_min}–{dados.umidade_max}%</span>
        <span><Wind size={13} /> {dados.dir_vento} {dados.int_vento}</span>
      </div>
    </div>
  )
}

function CardAviso({ aviso }) {
  return (
    <div className={styles.aviso} style={{ '--cor-aviso': aviso.cor || 'var(--color-accent)' }}>
      <div className={styles.avisoFaixa} />
      <div className={styles.avisoConteudo}>
        <div className={styles.avisoCabecalho}>
          <AlertTriangle size={16} />
          <span className={styles.avisoTitulo}>{aviso.descricao}</span>
        </div>
        <span className={styles.avisoSeveridade}>{aviso.severidade}</span>
        {aviso.riscos.length > 0 && (
          <p className={styles.avisoTexto}>Riscos: {aviso.riscos.join(', ')}</p>
        )}
        {aviso.instrucoes.length > 0 && (
          <p className={styles.avisoTexto}>{aviso.instrucoes.join(' ')}</p>
        )}
        <span className={styles.avisoPeriodo}>
          {aviso.data_inicio} {aviso.hora_inicio} até {aviso.data_fim} {aviso.hora_fim}
        </span>
      </div>
    </div>
  )
}

function ClimaInmet() {
  const [uf, setUf] = useState('')
  const [estacoesDoEstado, setEstacoesDoEstado] = useState([])
  const [codigoEstacao, setCodigoEstacao] = useState('')
  const [municipios, setMunicipios] = useState([])
  const [codigoIbge, setCodigoIbge] = useState('')

  const [previsao, setPrevisao] = useState(null)
  const [erroPrevisao, setErroPrevisao] = useState(null)

  const [avisos, setAvisos] = useState(null)
  const [erroAvisos, setErroAvisos] = useState(null)

  const [todasEstacoes, setTodasEstacoes] = useState([])
  const [erroMapa, setErroMapa] = useState(null)

  const [carregandoInicial, setCarregandoInicial] = useState(true)

  // Carga inicial: perfil (pra sugerir o estado da conta) + todas as
  // estações do Brasil (usadas só pelo mapa, sem filtro de UF).
  useEffect(() => {
    async function carregar() {
      try {
        const perfil = await buscarMeuPerfil()
        setUf((perfil?.estado || '').toUpperCase())
      } catch {
        // Sem perfil disponível: segue sem sugestão de estado, a pessoa escolhe manualmente.
      }
      try {
        const estacoes = await buscarEstacoesInmet()
        setTodasEstacoes(estacoes)
      } catch {
        setErroMapa('Não foi possível carregar o mapa de estações do INMET agora.')
      }
      setCarregandoInicial(false)
    }
    carregar()
  }, [])

  // Troca de UF: recarrega estações do estado, municípios do estado e avisos.
  useEffect(() => {
    if (!uf) return
    setCodigoEstacao('')
    setCodigoIbge('')
    setPrevisao(null)

    buscarEstacoesInmet(uf)
      .then(setEstacoesDoEstado)
      .catch(() => setEstacoesDoEstado([]))

    buscarMunicipiosPorUf(uf)
      .then((lista) => {
        setMunicipios(lista)
        return lista
      })
      .catch(() => setMunicipios([]))

    buscarAvisosInmet(uf)
      .then((dados) => {
        setAvisos(dados)
        setErroAvisos(null)
      })
      .catch(() => setErroAvisos('Não foi possível carregar os avisos oficiais agora.'))
  }, [uf])

  // Assim que os municípios do estado chegam, tenta pré-selecionar o
  // município que bate com a cidade cadastrada no perfil da conta.
  useEffect(() => {
    if (municipios.length === 0 || codigoIbge) return
    buscarMeuPerfil()
      .then((perfil) => {
        const cidade = normalizarTexto(perfil?.cidade)
        const encontrado = cidade && municipios.find((m) => normalizarTexto(m.nome) === cidade)
        setCodigoIbge(encontrado ? encontrado.codigo : municipios[0].codigo)
      })
      .catch(() => setCodigoIbge(municipios[0].codigo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipios])

  useEffect(() => {
    if (estacoesDoEstado.length > 0 && !codigoEstacao) {
      setCodigoEstacao(estacoesDoEstado[0].codigo)
    }
  }, [estacoesDoEstado, codigoEstacao])

  useEffect(() => {
    if (!codigoIbge) return
    buscarPrevisaoInmet(codigoIbge)
      .then((dados) => {
        setPrevisao(dados)
        setErroPrevisao(null)
      })
      .catch(() => setErroPrevisao('Não foi possível carregar a previsão agora.'))
  }, [codigoIbge])

  const estacaoSelecionada = useMemo(
    () => estacoesDoEstado.find((item) => item.codigo === codigoEstacao) ?? null,
    [estacoesDoEstado, codigoEstacao],
  )

  const cabecalho = (
    <CabecalhoStandard
      subtitulo="Dados públicos oficiais do INMET para a sua região — separado dos dados da sua estação."
      mostrarChips={false}
      mostrarExportar={false}
    />
  )

  if (carregandoInicial) {
    return (
      <div className={styles.pagina}>
        {cabecalho}
        <StatusMessage texto="Carregando dados do INMET..." />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      {cabecalho}

      <section className={styles.card}>
        <h2 className={styles.tituloSecao}><MapPin size={16} /> Seletor de referência</h2>
        <div className={styles.seletores}>
          <label className={styles.campo}>
            <span>Estado</span>
            <select value={uf} onChange={(evento) => setUf(evento.target.value)}>
              <option value="">Selecione</option>
              {UFS.map((sigla) => (
                <option key={sigla} value={sigla}>{sigla}</option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            <span>Estação INMET de referência</span>
            <select
              value={codigoEstacao}
              onChange={(evento) => setCodigoEstacao(evento.target.value)}
              disabled={estacoesDoEstado.length === 0}
            >
              {estacoesDoEstado.length === 0 && <option value="">Selecione um estado</option>}
              {estacoesDoEstado.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.nome}</option>
              ))}
            </select>
          </label>

          <label className={styles.campo}>
            <span>Município (previsão)</span>
            <select
              value={codigoIbge}
              onChange={(evento) => setCodigoIbge(evento.target.value)}
              disabled={municipios.length === 0}
            >
              {municipios.length === 0 && <option value="">Selecione um estado</option>}
              {municipios.map((item) => (
                <option key={item.codigo} value={item.codigo}>{item.nome}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={styles.grid2Colunas}>
        <div className={styles.card}>
          <h2 className={styles.tituloSecao}><Landmark size={16} /> Estação de referência (INMET)</h2>
          {!estacaoSelecionada ? (
            <CardVazio texto="Escolha um estado com estação disponível para ver os detalhes." />
          ) : (
            <div className={styles.estacaoInfo}>
              <div className={styles.estacaoLinha}>
                <span className={styles.estacaoRotulo}>Nome</span>
                <span>{estacaoSelecionada.nome}</span>
              </div>
              <div className={styles.estacaoLinha}>
                <span className={styles.estacaoRotulo}>Código</span>
                <span>{estacaoSelecionada.codigo}</span>
              </div>
              <div className={styles.estacaoLinha}>
                <span className={styles.estacaoRotulo}>Coordenadas</span>
                <span>{estacaoSelecionada.latitude}, {estacaoSelecionada.longitude}</span>
              </div>
              <div className={styles.estacaoLinha}>
                <span className={styles.estacaoRotulo}>Altitude</span>
                <span>{estacaoSelecionada.altitude} m</span>
              </div>
              <div className={styles.estacaoLinha}>
                <span className={styles.estacaoRotulo}>Status</span>
                <span className={estacaoSelecionada.operante ? styles.statusOperante : styles.statusPane}>
                  {estacaoSelecionada.situacao}
                </span>
              </div>
              <p className={styles.avisoTexto}>
                O INMET não disponibiliza leitura ao vivo desta estação via API pública no momento — mostramos só a
                identificação e localização oficiais dela.
              </p>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.tituloSecao}><CloudSun size={16} /> Previsão (5 dias)</h2>
          {erroPrevisao ? (
            <CardVazio texto={erroPrevisao} />
          ) : !previsao || previsao.dias.length === 0 ? (
            <CardVazio texto="Escolha um município para ver a previsão." />
          ) : (
            <div className={styles.dias}>
              {previsao.dias.map((dia) => (
                <div key={dia.data} className={styles.dia}>
                  <span className={styles.diaData}>{dia.dia_semana ?? dia.data}</span>
                  {dia.dia_inteiro ? (
                    <div className={styles.diaPeriodos}>
                      <PeriodoPrevisao nome="Previsão do dia" dados={dia.dia_inteiro} />
                    </div>
                  ) : (
                    <div className={styles.diaPeriodos}>
                      <PeriodoPrevisao nome={NOMES_DIA.manha} dados={dia.manha} />
                      <PeriodoPrevisao nome={NOMES_DIA.tarde} dados={dia.tarde} />
                      <PeriodoPrevisao nome={NOMES_DIA.noite} dados={dia.noite} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.tituloSecao}><AlertTriangle size={16} /> Avisos oficiais</h2>
        {erroAvisos ? (
          <CardVazio texto={erroAvisos} />
        ) : !avisos || (avisos.hoje.length === 0 && avisos.futuro.length === 0) ? (
          <CardVazio texto="Nenhum aviso oficial ativo para o estado selecionado no momento." />
        ) : (
          <div className={styles.avisos}>
            {[...avisos.hoje, ...avisos.futuro].map((aviso) => (
              <CardAviso key={aviso.id} aviso={aviso} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.tituloSecao}><MapPin size={16} /> Mapa de estações</h2>
        {erroMapa ? (
          <CardVazio texto={erroMapa} />
        ) : (
          <div className={styles.mapaContainer}>
            <MapContainer center={[-14.2, -51.9]} zoom={4} scrollWheelZoom={false} className={styles.mapa}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {todasEstacoes
                .filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
                .map((item) => (
                <CircleMarker
                  key={item.codigo}
                  center={[Number(item.latitude), Number(item.longitude)]}
                  radius={4}
                  pathOptions={{
                    color: item.operante ? 'var(--color-status-online)' : 'var(--color-status-offline)',
                    fillOpacity: 0.8,
                  }}
                >
                  <Popup>
                    <strong>{item.nome}</strong>
                    <br />
                    {item.uf} · {item.situacao}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}
      </section>
    </div>
  )
}

export default ClimaInmet
