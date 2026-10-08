import styles from './IndicadorTipoEstacao.module.css'

// Bolinha indicando o TIPO da estação (física = hardware real, online =
// dados da Open-Meteo) — não confundir com o pill "Online"/"Offline" que
// já existe ao lado (esta_online, CONECTIVIDADE: transmitiu recentemente
// ou não). São dois conceitos diferentes que, por coincidência de
// vocabulário, usam a mesma palavra "online" — por isso esta bolinha usa
// posição e cor distintas do pill de conectividade, e nunca o texto
// "Online" sozinho (sempre com o rótulo "estação online/física" por
// extenso, via title, pra não reforçar a confusão).
function IndicadorTipoEstacao({ tipo }) {
  const ehOnline = tipo === 'online'
  return (
    <span
      className={`${styles.bolinha} ${ehOnline ? styles.online : styles.fisica}`}
      title={ehOnline ? 'Estação online (dados da Open-Meteo)' : 'Estação física (hardware ESP32/LoRa)'}
    />
  )
}

export default IndicadorTipoEstacao
