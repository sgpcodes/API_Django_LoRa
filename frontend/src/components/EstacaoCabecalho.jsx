import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Radio, Maximize2, ChevronDown } from 'lucide-react'
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
// + mapa. `coordenadas` vem da estação virtual selecionada (ver
// services/estacoesVirtuais.js) até existir cadastro de GPS de verdade
// (ver parecer sobre Open-Meteo — é a mesma lacuna registrada lá).
//
// `opcoesEstacao` (opcional): quando vem com mais de uma opção, o nome
// vira um seletor de verdade — é o piloto de várias estações virtuais
// (RF-13), não uma estação fixa por conta. Sem isso (ou com só uma
// opção), mostra só o nome, sem dropdown.
function EstacaoCabecalho({ nome, online, localizacaoTexto, coordenadas, opcoesEstacao, estacaoSelecionadaId, onMudarEstacao }) {
  const { t } = useTranslation()
  const [mapaExpandido, setMapaExpandido] = useState(false)
  const coordenadaTexto = `${formatarCoordenada(coordenadas.latitude, 'N', 'S')}, ${formatarCoordenada(coordenadas.longitude, 'L', 'O')}`
  const temSeletor = opcoesEstacao?.length > 1

  return (
    <div className={styles.cabecalho}>
      <div className={styles.identidade}>
        <span className={styles.avatar}>
          <Radio size={22} />
        </span>
        <div className={styles.textos}>
          <div className={styles.linhaNome}>
            {temSeletor ? (
              <span className={styles.seletorNome}>
                <select
                  id="estacao-selecionada"
                  className={styles.selectNome}
                  value={estacaoSelecionadaId}
                  onChange={(evento) => onMudarEstacao(evento.target.value)}
                  aria-label={t('estacaoPagina.escolherEstacao')}
                >
                  {opcoesEstacao.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className={styles.chevronNome} />
              </span>
            ) : (
              <h1 className={styles.nome}>{nome}</h1>
            )}
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
