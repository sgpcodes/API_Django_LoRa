import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Radio, Maximize2 } from 'lucide-react'
import Modal from './Modal'
import IndicadorTipoEstacao from './IndicadorTipoEstacao'
import styles from './EstacaoCabecalho.module.css'

// Formata grau decimal em "22.9256° S" / "42.8156° W" — convenção comum de
// coordenadas geográficas, mais legível pra quem não lê "-22.9256" de cara.
function formatarCoordenada(valor, positivo, negativo) {
  const letra = valor >= 0 ? positivo : negativo
  return `${Math.abs(valor).toFixed(4)}° ${letra}`
}

function Mapa({ latitude, longitude, nome, altura }) {
  return (
    <MapContainer
      key={`${latitude},${longitude}`}
      center={[latitude, longitude]}
      zoom={11}
      scrollWheelZoom={false}
      className={styles.mapa}
      style={{ height: altura }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[latitude, longitude]} radius={9} pathOptions={{ color: 'var(--color-accent)', fillOpacity: 0.85 }}>
        <Popup>{nome}</Popup>
      </CircleMarker>
    </MapContainer>
  )
}

// Cabeçalho da página da estação: nome + indicador de tipo (física/online,
// ver IndicadorTipoEstacao.jsx) + status de conectividade (RN17,
// `esta_offline` já vem calculado do backend) + localização + mapa. Não
// tem mais seletor de Estado/Cidade — isso existia quando esta tela
// deixava escolher qualquer cidade livremente; agora mostra sempre a
// estação ATRIBUÍDA à conta (ver pages/Dashboard.jsx). O mapa só aparece
// se a estação tiver latitude/longitude — só estação tipo=online tem
// (física não tem coordenada, só `localizacao` em texto livre).
function EstacaoCabecalho({ estacao }) {
  const { t } = useTranslation()
  const [mapaExpandido, setMapaExpandido] = useState(false)
  const temCoordenadas = estacao.latitude != null && estacao.longitude != null
  const online = !estacao.esta_offline
  const coordenadaTexto = temCoordenadas
    ? `${formatarCoordenada(estacao.latitude, 'N', 'S')}, ${formatarCoordenada(estacao.longitude, 'L', 'O')}`
    : estacao.localizacao || '—'

  return (
    <div className={styles.cabecalho}>
      <div className={styles.identidade}>
        <span className={styles.avatar}>
          <Radio size={22} />
        </span>
        <div className={styles.textos}>
          <div className={styles.linhaNome}>
            <IndicadorTipoEstacao tipo={estacao.tipo} />
            <span className={styles.nomeEstacao}>{estacao.nome || estacao.identificador}</span>

            <span className={`${styles.status} ${online ? styles.statusOnline : styles.statusOffline}`}>
              <span className={styles.pontoStatus} />
              {online ? t('estacaoPagina.online') : t('estacaoPagina.offline')}
            </span>
          </div>

          <span className={styles.coordenadas}>{coordenadaTexto}</span>
        </div>
      </div>

      {temCoordenadas && (
        <div className={styles.mapaContainer}>
          <Mapa latitude={estacao.latitude} longitude={estacao.longitude} nome={estacao.nome} altura="100%" />
          <button
            type="button"
            className={styles.botaoExpandir}
            onClick={() => setMapaExpandido(true)}
            aria-label={t('estacaoPagina.expandirMapa')}
            title={t('estacaoPagina.expandirMapa')}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      {temCoordenadas && (
        <Modal aberto={mapaExpandido} onFechar={() => setMapaExpandido(false)} titulo={estacao.nome} icone={Radio}>
          <Mapa latitude={estacao.latitude} longitude={estacao.longitude} nome={estacao.nome} altura="60vh" />
        </Modal>
      )}
    </div>
  )
}

export default EstacaoCabecalho
