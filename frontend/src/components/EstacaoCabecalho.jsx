import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Radio, Maximize2 } from 'lucide-react'
import Modal from './Modal'
import styles from './EstacaoCabecalho.module.css'

// Formata grau decimal em "22.9256° S" / "42.8156° W" — convenção comum de
// coordenadas geográficas, mais legível pra quem não lê "-22.9256" de cara.
function formatarCoordenada(valor, positivo, negativo) {
  const letra = valor >= 0 ? positivo : negativo
  return `${Math.abs(valor).toFixed(4)}° ${letra}`
}

function Mapa({ coordenadas, nome, altura }) {
  return (
    <MapContainer
      center={[coordenadas.latitude, coordenadas.longitude]}
      zoom={11}
      scrollWheelZoom={false}
      className={styles.mapa}
      style={{ height: altura }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={[coordenadas.latitude, coordenadas.longitude]}
        radius={9}
        pathOptions={{ color: 'var(--color-accent)', fillOpacity: 0.85 }}
      >
        <Popup>{nome}</Popup>
      </CircleMarker>
    </MapContainer>
  )
}

// Cabeçalho da página da estação: identidade (nome, status) + localização
// + mapa. `coordenadas` vem de COORDENADAS_PADRAO (climaExternoService) até
// existir um campo de GPS próprio no cadastro da Estação (ver parecer sobre
// estações virtuais — é a mesma lacuna registrada lá).
function EstacaoCabecalho({ nome, online, localizacaoTexto, coordenadas }) {
  const { t } = useTranslation()
  const [mapaExpandido, setMapaExpandido] = useState(false)
  const coordenadaTexto = `${formatarCoordenada(coordenadas.latitude, 'N', 'S')}, ${formatarCoordenada(coordenadas.longitude, 'L', 'O')}`

  return (
    <div className={styles.cabecalho}>
      <div className={styles.identidade}>
        <span className={styles.avatar}>
          <Radio size={22} />
        </span>
        <div className={styles.textos}>
          <div className={styles.linhaNome}>
            <h1 className={styles.nome}>{nome}</h1>
            <span className={`${styles.status} ${online ? styles.statusOnline : styles.statusOffline}`}>
              <span className={styles.pontoStatus} />
              {online ? t('estacaoPagina.online') : t('estacaoPagina.offline')}
            </span>
          </div>
          <span className={styles.localizacao}>{localizacaoTexto}</span>
          <span className={styles.coordenadas}>{coordenadaTexto}</span>
        </div>
      </div>

      <div className={styles.mapaContainer}>
        <Mapa coordenadas={coordenadas} nome={nome} altura="100%" />
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

      <Modal aberto={mapaExpandido} onFechar={() => setMapaExpandido(false)} titulo={nome} icone={Radio}>
        <Mapa coordenadas={coordenadas} nome={nome} altura="60vh" />
      </Modal>
    </div>
  )
}

export default EstacaoCabecalho
