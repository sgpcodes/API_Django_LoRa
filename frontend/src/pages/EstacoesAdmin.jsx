import { useEffect, useMemo, useState } from 'react'
import { Radio } from 'lucide-react'
import EstacaoAdminCard from '../components/EstacaoAdminCard'
import StatusMessage from '../components/StatusMessage'
import { buscarLeituras, estaOnline, obterUltimaLeituraPorSensor } from '../services/leiturasService'
import { buscarEstacoes, removerEstacao, trocarDonoEstacao } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import styles from './EstacoesAdmin.module.css'

const INTERVALO_ATUALIZACAO_MS = 60_000

// Tela "Estações" do Painel Administrativo: todas as estações (ESP32) que
// já mandaram leitura, num só lugar — dados atuais, dono (ou "Sem dono",
// pros sensores ainda não cadastrados) e, ao abrir "Detalhes", RSSI/SNR e
// configuração do rádio — tudo reduzido, sem precisar trocar de tela.
// Atribuir um sensor sem dono a uma conta é feito na aba Contas; trocar o
// dono de uma já cadastrada ou remover é feito direto aqui (RN15: em
// qualquer plano).
function EstacoesAdmin() {
  const [leituras, setLeituras] = useState([])
  const [estacoes, setEstacoes] = useState([])
  const [contas, setContas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const [processandoId, setProcessandoId] = useState(null)
  const [erroPorId, setErroPorId] = useState({})

  async function carregar() {
    try {
      const [dadosLeituras, dadosEstacoes, dadosContas] = await Promise.all([
        buscarLeituras(),
        buscarEstacoes(),
        buscarContas(),
      ])
      setLeituras(dadosLeituras)
      setEstacoes(dadosEstacoes)
      setContas(dadosContas)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar as estações agora.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const dispositivos = useMemo(() => {
    const estacaoPorIdentificador = new Map(estacoes.map((estacao) => [estacao.identificador, estacao]))
    return obterUltimaLeituraPorSensor(leituras).map((leitura) => {
      const estacao = estacaoPorIdentificador.get(leitura.sensor_id)
      return {
        ...leitura,
        estacaoId: estacao?.id ?? null,
        donoId: estacao?.dono ?? null,
        nome: estacao?.nome ?? null,
        donoNome: estacao?.dono_nome ?? null,
      }
    })
  }, [leituras, estacoes])

  const totalOnline = dispositivos.filter((d) => estaOnline(d.data_hora)).length
  const totalSemDono = dispositivos.filter((d) => !d.donoNome).length

  async function aoTrocarDono(estacaoId, novoDonoId) {
    setProcessandoId(estacaoId)
    setErroPorId((atual) => ({ ...atual, [estacaoId]: null }))
    try {
      await trocarDonoEstacao(estacaoId, novoDonoId)
      await carregar()
    } catch (erroRequisicao) {
      const mensagem = erroRequisicao.response?.data?.dono?.[0] ?? 'Não foi possível trocar o dono. Tente de novo.'
      setErroPorId((atual) => ({ ...atual, [estacaoId]: mensagem }))
    } finally {
      setProcessandoId(null)
    }
  }

  async function aoRemover(estacaoId) {
    setProcessandoId(estacaoId)
    setErroPorId((atual) => ({ ...atual, [estacaoId]: null }))
    try {
      await removerEstacao(estacaoId)
      await carregar()
    } catch {
      setErroPorId((atual) => ({ ...atual, [estacaoId]: 'Não foi possível remover a estação. Tente de novo.' }))
      setProcessandoId(null)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando estações..." />
      </div>
    )
  }

  if (erro) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto={erro} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Radio size={20} />
            Estações
          </h1>
          <p className={styles.subtitulo}>Todos os sensores que já enviaram leitura, com status e configuração do rádio.</p>
        </div>
        <div className={styles.resumo}>
          <span className={styles.resumoItem}>
            <strong>{dispositivos.length}</strong> no total
          </span>
          <span className={styles.resumoItem}>
            <strong>{totalOnline}</strong> online
          </span>
          {totalSemDono > 0 && (
            <span className={`${styles.resumoItem} ${styles.resumoAlerta}`}>
              <strong>{totalSemDono}</strong> sem dono
            </span>
          )}
        </div>
      </div>

      {dispositivos.length === 0 ? (
        <p className={styles.semDados}>Nenhuma estação enviou dados ainda.</p>
      ) : (
        <div className={styles.lista}>
          {dispositivos.map((dispositivo) => (
            <EstacaoAdminCard
              key={dispositivo.sensor_id}
              dispositivo={dispositivo}
              contas={contas}
              processando={dispositivo.estacaoId != null && processandoId === dispositivo.estacaoId}
              erro={dispositivo.estacaoId != null ? erroPorId[dispositivo.estacaoId] : null}
              onTrocarDono={(novoDonoId) => aoTrocarDono(dispositivo.estacaoId, novoDonoId)}
              onRemover={() => aoRemover(dispositivo.estacaoId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default EstacoesAdmin
