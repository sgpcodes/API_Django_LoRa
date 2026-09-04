import { useEffect, useMemo, useState } from 'react'
import { Radio } from 'lucide-react'
import EstacaoAdminCard from '../components/EstacaoAdminCard'
import StatusMessage from '../components/StatusMessage'
import { buscarLeituras, estaOnline, obterUltimaLeituraPorSensor } from '../services/leiturasService'
import { atualizarEstacao, buscarEstacoes, removerEstacao, trocarDonoEstacao } from '../services/estacaoService'
import { buscarContas } from '../services/contasAdminService'
import styles from './EstacoesAdmin.module.css'

const INTERVALO_ATUALIZACAO_MS = 60_000

// Tela "Estações" do Painel Administrativo: todas as estações (ESP32) que
// já mandaram leitura, num só lugar — dados atuais, dono (ou "Sem dono",
// pros sensores ainda não cadastrados) e, ao abrir "Detalhes", RSSI/SNR e
// configuração do rádio — tudo reduzido, sem precisar trocar de tela.
// Atribuir um sensor sem dono a uma conta é feito na aba Contas; editar,
// trocar o dono de uma já cadastrada ou remover é feito direto aqui
// (RN15: em qualquer plano).
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
        intervaloEnvioMinutos: estacao?.intervalo_envio_minutos ?? null,
        limiteOfflineMinutos: estacao?.limite_offline_minutos ?? null,
        ativa: estacao?.ativa ?? null,
      }
    })
  }, [leituras, estacoes])

  const totalOnline = dispositivos.filter((d) => estaOnline(d.data_hora)).length
  const totalSemDono = dispositivos.filter((d) => !d.donoNome).length

  async function executarAcao(estacaoId, acao) {
    setProcessandoId(estacaoId)
    setErroPorId((atual) => ({ ...atual, [estacaoId]: null }))
    try {
      await acao()
      await carregar()
      return true
    } catch (erroRequisicao) {
      const dados = erroRequisicao.response?.data
      const mensagem = dados?.dono?.[0] ?? dados?.detail ?? dados?.non_field_errors?.[0] ?? 'Não foi possível concluir. Tente de novo.'
      setErroPorId((atual) => ({ ...atual, [estacaoId]: mensagem }))
      return false
    } finally {
      setProcessandoId(null)
    }
  }

  const aoTrocarDono = (estacaoId, novoDonoId) => executarAcao(estacaoId, () => trocarDonoEstacao(estacaoId, novoDonoId))
  const aoRemover = (estacaoId) => executarAcao(estacaoId, () => removerEstacao(estacaoId))
  const aoSalvarEdicao = (estacaoId, dados) => executarAcao(estacaoId, () => atualizarEstacao(estacaoId, dados))

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
              onSalvarEdicao={(dados) => aoSalvarEdicao(dispositivo.estacaoId, dados)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default EstacoesAdmin
