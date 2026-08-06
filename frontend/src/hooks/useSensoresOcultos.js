import { useEffect, useState } from 'react'
import { obterUltimaLeituraPorSensor } from '../services/leiturasService'

function carregar(chave) {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto ? JSON.parse(bruto) : {}
  } catch {
    return {}
  }
}

function salvar(chave, ocultos) {
  try {
    localStorage.setItem(chave, JSON.stringify(ocultos))
  } catch {
    // localStorage indisponível (ex.: modo privado) — a remoção só não
    // sobrevive a um recarregar da página, sem quebrar nada.
  }
}

// Sensores removidos manualmente de uma página (Visão Geral, Dados do
// LoRa...), guardados no localStorage do navegador junto do instante da
// remoção (epoch ms) — por página, via "chave", pra remover num lugar não
// esconder o mesmo sensor no outro. Um sensor volta a aparecer sozinho
// assim que manda uma leitura mais nova que esse instante: "remover" aqui
// significa "esconder enquanto ficar inativo", não "banir para sempre".
export function useSensoresOcultos(chave, leituras) {
  const [ocultosDesde, setOcultosDesde] = useState(() => carregar(chave))

  useEffect(() => {
    setOcultosDesde((atual) => {
      if (Object.keys(atual).length === 0) return atual

      const ultimaLeituraPorSensor = new Map(
        obterUltimaLeituraPorSensor(leituras).map((leitura) => [leitura.sensor_id, leitura.data_hora])
      )

      let mudou = false
      const proximo = { ...atual }
      Object.entries(atual).forEach(([sensorId, ocultoDesde]) => {
        const ultimaLeitura = ultimaLeituraPorSensor.get(sensorId)
        if (ultimaLeitura && new Date(ultimaLeitura).getTime() > ocultoDesde) {
          delete proximo[sensorId]
          mudou = true
        }
      })

      if (mudou) salvar(chave, proximo)
      return mudou ? proximo : atual
    })
  }, [leituras, chave])

  function ocultarSensor(sensorId) {
    setOcultosDesde((atual) => {
      const proximo = { ...atual, [sensorId]: Date.now() }
      salvar(chave, proximo)
      return proximo
    })
  }

  return { ocultosDesde, ocultarSensor }
}
