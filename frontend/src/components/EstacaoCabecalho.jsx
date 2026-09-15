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
      // `key` força o Leaflet a remontar (e recentralizar) quando a
      // coordenada muda — `center` sozinho só vale na primeira montagem,
      // trocar de cidade não move o mapa sem isso.
      key={`${coordenadas.latitude},${coordenadas.longitude}`}
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

// Cabeçalho da página da estação: seletor de localização (Estado/Cidade,
// catálogo do IBGE) + status + mapa. Não existe "nome de estação" fictício
// aqui — o Open-Meteo não tem estação nenhuma, só responde clima por
// coordenada (ver conversa no parecer: a "identidade" que existe é a
// própria cidade escolhida, geocodificada na hora — ver
// services/geocodingService.js). `coordenadas` fica null enquanto a
// geocodificação da cidade escolhida ainda não voltou.
function EstacaoCabecalho({
  cidade,
  uf,
  online,
  coordenadas,
  carregandoLocalizacao,
  ufs,
  municipios,
  onMudarUf,
  onMudarCidade,
}) {
  const { t } = useTranslation()
  const [mapaExpandido, setMapaExpandido] = useState(false)
  const coordenadaTexto = coordenadas
    ? `${formatarCoordenada(coordenadas.latitude, 'N', 'S')}, ${formatarCoordenada(coordenadas.longitude, 'L', 'O')}`
    : t('estacaoPagina.localizando')

  return (
    <div className={styles.cabecalho}>
      <div className={styles.identidade}>
        <span className={styles.avatar}>
          <Radio size={22} />
        </span>
        <div className={styles.textos}>
          <div className={styles.linhaNome}>
            <span className={styles.seletorNome}>
              <select
                id="cidade-selecionada"
                className={styles.selectNome}
                value={cidade}
                onChange={(evento) => onMudarCidade(evento.target.value)}
                disabled={municipios.length === 0}
                aria-label={t('estacaoPagina.escolherCidade')}
              >
                {municipios.length === 0 && <option value="">{t('estacaoPagina.carregandoCidades')}</option>}
                {municipios.map((municipio) => (
                  <option key={municipio.codigo} value={municipio.nome}>
                    {municipio.nome}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className={styles.chevronNome} />
            </span>
            <span className={`${styles.status} ${online ? styles.statusOnline : styles.statusOffline}`}>
              <span className={styles.pontoStatus} />
              {online ? t('estacaoPagina.online') : t('estacaoPagina.offline')}
            </span>
          </div>

          <span className={styles.seletorUf}>
            <select
              id="uf-selecionada"
              className={styles.selectUf}
              value={uf}
              onChange={(evento) => onMudarUf(evento.target.value)}
              aria-label={t('estacaoPagina.escolherEstado')}
            >
              {ufs.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {sigla}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className={styles.chevronUf} />
          </span>

          <span className={styles.coordenadas}>{carregandoLocalizacao ? t('estacaoPagina.localizando') : coordenadaTexto}</span>
        </div>
      </div>

      <div className={styles.mapaContainer}>
        {coordenadas && <Mapa coordenadas={coordenadas} nome={cidade} altura="100%" />}
        <button
          type="button"
          className={styles.botaoExpandir}
          onClick={() => setMapaExpandido(true)}
          aria-label={t('estacaoPagina.expandirMapa')}
          title={t('estacaoPagina.expandirMapa')}
          disabled={!coordenadas}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {coordenadas && (
        <Modal aberto={mapaExpandido} onFechar={() => setMapaExpandido(false)} titulo={cidade} icone={Radio}>
          <Mapa coordenadas={coordenadas} nome={cidade} altura="60vh" />
        </Modal>
      )}
    </div>
  )
}

export default EstacaoCabecalho
