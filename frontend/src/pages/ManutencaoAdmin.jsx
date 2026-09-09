import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Globe,
  HardDrive,
  History,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarInfoSistema, buscarResumoLimpeza, executarLimpeza } from '../services/manutencaoService'
import styles from './ManutencaoAdmin.module.css'

const FRASE_CONFIRMACAO = 'APAGAR TUDO'

const ROTULOS_ACAO = {
  'estacao.criada': 'Estação cadastrada',
  'estacao.usuarios_alterados': 'Usuários da estação alterados',
  'manutencao.limpeza_operacional': 'Limpeza operacional executada',
}

function rotuloAcao(acao) {
  return ROTULOS_ACAO[acao] ?? acao
}

function formatarDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Tela "Manutenção" do Painel Administrativo — combina um painel de
// "entranhas do sistema" (só leitura: tamanho do banco, contagens,
// atividade recente, integrações externas) com a zona de risco de
// verdade (apagar contas e dados operacionais). Nada no painel de
// informações é inventado — tudo vem de contas/views.py:InfoSistemaView,
// que só reúne números que já existem em outros lugares do sistema.
//
// Duas travas antes de executar a limpeza: precisa digitar a frase exata
// E confirmar num segundo aviso (window.confirm) — bem mais fricção que
// qualquer outro botão do painel, de propósito, porque isso aqui não
// tem desfazer.
function ManutencaoAdmin() {
  const [resumo, setResumo] = useState(null)
  const [info, setInfo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [erroInfo, setErroInfo] = useState(null)
  const [fraseDigitada, setFraseDigitada] = useState('')
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState(null)

  async function carregar() {
    setCarregando(true)
    try {
      const dados = await buscarResumoLimpeza()
      setResumo(dados)
      setErro(null)
    } catch {
      setErro('Não foi possível carregar a prévia agora.')
    } finally {
      setCarregando(false)
    }

    try {
      const dadosInfo = await buscarInfoSistema()
      setInfo(dadosInfo)
      setErroInfo(null)
    } catch {
      setErroInfo('Não foi possível carregar as informações do sistema agora.')
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const nadaParaApagar =
    resumo && resumo.leituras === 0 && resumo.estacoes === 0 && resumo.contas === 0 && resumo.solicitacoes_rssi === 0

  async function aoConfirmarLimpeza() {
    if (
      !window.confirm(
        `Isso vai apagar ${resumo.contas} conta(s), ${resumo.estacoes} estação(ões) e ${resumo.leituras} leitura(s) PRA SEMPRE. Não tem como desfazer. Confirma?`,
      )
    ) {
      return
    }

    setExecutando(true)
    setErro(null)
    try {
      const dados = await executarLimpeza()
      setResultado(dados)
      setFraseDigitada('')
      await carregar()
    } catch {
      setErro('Não foi possível concluir a limpeza. Tente de novo.')
    } finally {
      setExecutando(false)
    }
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando..." />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.banner}>
        <div className={styles.bannerConteudo}>
          <div className={styles.bannerIcone}>
            <Database size={26} />
          </div>
          <div>
            <h1 className={styles.bannerTitulo}>Manutenção</h1>
            <p className={styles.bannerSubtitulo}>
              As entranhas do sistema, e a zona de risco pra zerar os dados operacionais.
            </p>
          </div>
        </div>
      </div>

      {erroInfo && <p className={styles.erroCarga}>{erroInfo}</p>}

      {info && (
        <>
          <div className={styles.gradeInfo}>
            <div className={styles.cartaoInfo}>
              <div className={styles.cartaoInfoCabecalho}>
                <HardDrive size={16} />
                <span>Banco de dados</span>
              </div>
              <span className={styles.valorGrande}>{info.banco.tamanho_legivel ?? '—'}</span>
              <span className={styles.legendaInfo}>
                Motor: {info.banco.motor} · {info.contagens.contas} conta(s) · {info.contagens.estacoes} estação(ões)
                · {info.contagens.leituras} leitura(s) · {info.contagens.solicitacoes_rssi} RSSI ·{' '}
                {info.contagens.log_auditoria} evento(s) de auditoria
              </span>
            </div>

            <div className={styles.cartaoInfo}>
              <div className={styles.cartaoInfoCabecalho}>
                <Globe size={16} />
                <span>Integrações externas</span>
              </div>
              <div className={styles.listaIntegracoes}>
                {[
                  { chave: 'inmet', nome: 'INMET (clima)' },
                  { chave: 'ibge', nome: 'IBGE (municípios)' },
                ].map(({ chave, nome }) => {
                  const integracao = info.integracoes[chave]
                  return (
                    <div key={chave} className={styles.itemIntegracao}>
                      {integracao.online ? (
                        <CheckCircle2 size={15} className={styles.iconeOnline} />
                      ) : (
                        <XCircle size={15} className={styles.iconeOffline} />
                      )}
                      <span className={styles.itemIntegracaoNome}>{nome}</span>
                      <span className={integracao.online ? styles.pillOnline : styles.pillOffline}>
                        {integracao.online ? 'Online' : 'Fora do ar'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={styles.cartaoInfo}>
              <div className={styles.cartaoInfoCabecalho}>
                <Cpu size={16} />
                <span>Ambiente</span>
              </div>
              <div className={styles.listaAmbiente}>
                <span>Django {info.ambiente.django_versao}</span>
                <span>Python {info.ambiente.python_versao}</span>
                <span className={info.ambiente.debug ? styles.pillOffline : styles.pillOnline}>
                  {info.ambiente.debug ? 'DEBUG ativo' : 'DEBUG desligado'}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.cartaoAtividade}>
            <div className={styles.cartaoInfoCabecalho}>
              <History size={16} />
              <span>Atividade recente</span>
            </div>
            {info.atividade_recente.length === 0 ? (
              <p className={styles.semAtividade}>Nenhum evento registrado ainda.</p>
            ) : (
              <ul className={styles.listaAtividade}>
                {info.atividade_recente.map((evento) => (
                  <li key={evento.id} className={styles.itemAtividade}>
                    <span className={styles.itemAtividadeTexto}>
                      <strong>{evento.ator_username ?? 'sistema'}</strong> · {rotuloAcao(evento.acao)}
                    </span>
                    <span className={styles.itemAtividadeData}>
                      <Clock size={12} /> {formatarDataHora(evento.criado_em)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {erro && <p className={styles.erroCarga}>{erro}</p>}

      {resumo && (
        <div className={styles.cartaoPerigo}>
          <div className={styles.cabecalhoPerigo}>
            <ShieldAlert size={22} />
            <div>
              <h2 className={styles.tituloPerigo}>Apagar contas e dados de clima</h2>
              <p className={styles.textoPerigo}>
                Apaga todas as contas cadastradas (menos a sua, de superusuário), todas as estações e todo o
                histórico de leituras já recebido. <strong>Não apaga</strong> os planos, as funcionalidades nem o
                token de credenciamento — o sistema continua pronto pra receber cadastros novos depois.
                <strong> Essa ação não pode ser desfeita.</strong>
              </p>
            </div>
          </div>

          <div className={styles.grade}>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.contas}</span>
              <span className={styles.itemRotulo}>conta(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.estacoes}</span>
              <span className={styles.itemRotulo}>estação(ões)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.leituras}</span>
              <span className={styles.itemRotulo}>leitura(s)</span>
            </div>
            <div className={styles.item}>
              <span className={styles.itemValor}>{resumo.solicitacoes_rssi}</span>
              <span className={styles.itemRotulo}>solicitação(ões) RSSI</span>
            </div>
          </div>

          <p className={styles.preservados}>
            Preservado(s): conta(s) superusuário {resumo.superusuarios_preservados.join(', ')}, planos,
            funcionalidades e token de credenciamento.
          </p>

          {nadaParaApagar ? (
            <p className={styles.avisoVazio}>
              <AlertTriangle size={15} />
              Não há nada pra apagar agora — já está tudo zerado.
            </p>
          ) : (
            <div className={styles.blocoConfirmacao}>
              <label className={styles.rotuloConfirmacao} htmlFor="frase-confirmacao">
                Pra habilitar o botão, digite <strong>{FRASE_CONFIRMACAO}</strong> abaixo:
              </label>
              <input
                id="frase-confirmacao"
                className={styles.inputConfirmacao}
                value={fraseDigitada}
                onChange={(e) => setFraseDigitada(e.target.value)}
                placeholder={FRASE_CONFIRMACAO}
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.botaoApagar}
                disabled={fraseDigitada !== FRASE_CONFIRMACAO || executando}
                onClick={aoConfirmarLimpeza}
              >
                <Trash2 size={16} />
                {executando ? 'Apagando...' : 'Apagar tudo'}
              </button>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className={styles.cartaoResultado}>
          <RefreshCw size={16} />
          Pronto: {resultado.contas} conta(s), {resultado.estacoes} estação(ões) e {resultado.leituras} leitura(s)
          apagadas.
        </div>
      )}
    </div>
  )
}

export default ManutencaoAdmin
