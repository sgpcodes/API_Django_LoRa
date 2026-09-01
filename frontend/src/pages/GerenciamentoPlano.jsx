import { useEffect, useRef, useState } from 'react'
import {
  CreditCard,
  ShieldCheck,
  Zap,
  Radar,
  Rocket,
  Crown,
  Check,
  TrendingUp,
  Tag,
  XCircle,
  Lock,
  Bolt,
  Activity,
  CloudSun,
  Sparkles,
  FileText,
  Headset,
  HelpCircle,
  ArrowRight,
} from 'lucide-react'
import { buscarPlanos } from '../services/planosService'
import { obterClaimsDoToken } from '../services/authService'
import imagemApoioPlanos from '../assets/apoio-planos.png'
import styles from './GerenciamentoPlano.module.css'

const ICONE_POR_PLANO = { Standard: Crown, Pro: TrendingUp, Plus: Rocket }
const BANDEIRAS_CARTAO = ['VISA', 'MASTER', 'AMEX', 'ELO']

// Tela de Gerenciamento de Plano (2.2.2.5 do PDF): plano vigente, tabela
// comparativa entre Standard/Pro/Plus e um checkout embutido (não navega
// pra outra página — o resumo/pagamento na lateral já reage ao plano
// escolhido). Pagamento é simulado (sem gateway real integrado ainda).
function GerenciamentoPlano() {
  const [planos, setPlanos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(null)

  const [numeroCartao, setNumeroCartao] = useState('')
  const [nomeCartao, setNomeCartao] = useState('')
  const [validade, setValidade] = useState('')
  const [cvv, setCvv] = useState('')
  const [estadoPagamento, setEstadoPagamento] = useState('formulario') // formulario | processando | aprovado | recusado

  const refComparativo = useRef(null)
  const nomePlanoAtual = obterClaimsDoToken()?.plano ?? 'Standard'

  useEffect(() => {
    buscarPlanos()
      .then((dados) => {
        const ativos = dados.filter((plano) => plano.ativo).sort((a, b) => a.ordem - b.ordem)
        setPlanos(ativos)
        const outros = ativos.filter((plano) => plano.nome !== nomePlanoAtual)
        const destaque = outros[Math.min(0, outros.length - 1)] ?? ativos[Math.min(1, ativos.length - 1)]
        setPlanoSelecionadoId(destaque?.id ?? null)
      })
      .finally(() => setCarregando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const planoAtual = planos.find((plano) => plano.nome === nomePlanoAtual)
  const planoSelecionado = planos.find((plano) => plano.id === planoSelecionadoId)
  const planoMaisEscolhidoId = planos[1]?.id

  async function aoAssinar(evento) {
    evento.preventDefault()
    setEstadoPagamento('processando')
    await new Promise((resolver) => setTimeout(resolver, 1500))
    setEstadoPagamento('aprovado')
  }

  function listaRecursos(plano) {
    return [
      plano.max_estacoes == null ? 'Estações ilimitadas' : `Até ${plano.max_estacoes} estação(ões)`,
      `Histórico de ${plano.dias_historico} dias`,
      ...plano.funcionalidades_detalhe.map((f) => f.nome),
    ]
  }

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <p className={styles.carregando}>Carregando planos...</p>
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <CreditCard size={22} />
            Gerenciamento de Plano
          </h1>
          <p className={styles.subtitulo}>Escolha o plano ideal para potencializar o monitoramento da sua estação.</p>
        </div>
        <div className={styles.chipSeguro}>
          <ShieldCheck size={16} />
          <div>
            <strong>Ambiente seguro</strong>
            <span>Seus dados estão protegidos</span>
          </div>
        </div>
      </div>

      <div className={styles.grade}>
        <div className={styles.colunaPrincipal}>
          {/* Plano atual */}
          {planoAtual && (
            <section className={styles.cartaoAtual}>
              <div className={styles.blocoPlanoAtual}>
                <span className={styles.rotuloAtual}>Plano atual</span>
                <span className={styles.nomeAtualLinha}>
                  <span className={styles.nomeAtual}>{planoAtual.nome}</span>
                  <span className={styles.seloGratis}>
                    {Number(planoAtual.preco_mensal) === 0 ? 'Grátis' : `R$ ${Number(planoAtual.preco_mensal).toFixed(0)}/mês`}
                  </span>
                </span>
                <span className={styles.semHistorico}>
                  {Number(planoAtual.preco_mensal) === 0
                    ? 'Conta gratuita — sem histórico de pagamento.'
                    : 'Assinatura ativa.'}
                </span>
                <button
                  type="button"
                  className={styles.linkDetalhes}
                  onClick={() => refComparativo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  Ver detalhes do meu plano atual
                  <ArrowRight size={14} />
                </button>
              </div>

              <img src={imagemApoioPlanos} alt="" className={styles.ilustracao} />

              <div className={styles.blocoDestaques}>
                <div className={styles.destaque}>
                  <Zap size={18} />
                  <div>
                    <strong>Simples e eficiente</strong>
                    <span>Tudo que você precisa para começar</span>
                  </div>
                </div>
                <div className={styles.destaque}>
                  <Radar size={18} />
                  <div>
                    <strong>Dados em tempo real</strong>
                    <span>Monitore sua estação com confiança</span>
                  </div>
                </div>
                <div className={styles.destaque}>
                  <Rocket size={18} />
                  <div>
                    <strong>Evolua quando quiser</strong>
                    <span>Faça upgrade a qualquer momento</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Comparativo */}
          <section ref={refComparativo} className={styles.secaoComparativo}>
            <h2 className={styles.tituloComparativo}>Escolha o plano ideal para você</h2>
            <p className={styles.subtituloComparativo}>
              Todos os planos incluem monitoramento em tempo real e suporte dedicado.
            </p>

            <div className={styles.tabelaComparativa}>
              {planos.map((plano) => {
                const ehAtual = plano.nome === nomePlanoAtual
                // O selo "Mais escolhido" é fixo no plano do meio — não
                // muda. O contorno azul, não: segue o plano selecionado
                // (começa no mesmo do meio, mas troca ao clicar "Fazer
                // upgrade" em outro).
                const ehMaisEscolhido = plano.id === planoMaisEscolhidoId
                const ehSelecionado = plano.id === planoSelecionadoId
                const IconePlano = ICONE_POR_PLANO[plano.nome] ?? Crown
                return (
                  <div
                    key={plano.id}
                    className={`${styles.coluna} ${ehSelecionado ? styles.colunaDestaque : ''} ${ehAtual ? styles.colunaAtual : ''}`}
                  >
                    {ehMaisEscolhido && <span className={styles.seloDestaque}>Mais escolhido</span>}

                    <span className={styles.nomePlano}>{plano.nome}</span>
                    <span className={styles.precoPlano}>
                      {Number(plano.preco_mensal) === 0 ? (
                        'Grátis'
                      ) : (
                        <>
                          R$ {Number(plano.preco_mensal).toFixed(0)}
                          <span className={styles.precoPeriodo}>/mês</span>
                        </>
                      )}
                    </span>
                    <span className={styles.fraseCurta}>
                      {plano.nome === 'Standard' && 'Ideal para começar'}
                      {plano.nome === 'Pro' && 'Para quem quer mais controle'}
                      {plano.nome === 'Plus' && 'Máximo desempenho e inteligência'}
                    </span>

                    <ul className={styles.listaRecursos}>
                      {listaRecursos(plano).map((texto) => (
                        <li key={texto}>
                          <Check size={14} className={styles.iconeOk} />
                          {texto}
                        </li>
                      ))}
                    </ul>

                    <IconePlano size={44} className={styles.iconeMarcaDagua} />

                    {ehAtual ? (
                      <span className={styles.botaoAtual}>Plano atual</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.botaoUpgrade}
                        onClick={() => {
                          setPlanoSelecionadoId(plano.id)
                          setEstadoPagamento('formulario')
                        }}
                      >
                        Fazer upgrade
                        <TrendingUp size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Selos de confiança */}
          <section className={styles.linhaSelos}>
            <div className={styles.selo}>
              <Tag size={18} />
              <div>
                <strong>Sem taxa de adesão</strong>
                <span>Sem pegadinhas</span>
              </div>
            </div>
            <div className={styles.selo}>
              <XCircle size={18} />
              <div>
                <strong>Cancele quando quiser</strong>
                <span>Você tem o controle</span>
              </div>
            </div>
            <div className={styles.selo}>
              <Lock size={18} />
              <div>
                <strong>Pagamento seguro</strong>
                <span>Ambiente 100% seguro</span>
              </div>
            </div>
            <div className={styles.selo}>
              <Bolt size={18} />
              <div>
                <strong>Ative na hora</strong>
                <span>Acesso imediato após pagamento</span>
              </div>
            </div>
          </section>

          {/* Todos os planos incluem */}
          <section className={styles.secaoInclui}>
            <h2 className={styles.tituloComparativo}>Todos os planos incluem</h2>
            <div className={styles.linhaInclui}>
              <div className={styles.itemInclui}>
                <Activity size={20} />
                <span>Monitoramento em tempo real</span>
              </div>
              <div className={styles.itemInclui}>
                <CloudSun size={20} />
                <span>Dados meteorológicos completos</span>
              </div>
              <div className={styles.itemInclui}>
                <Sparkles size={20} />
                <span>Previsões inteligentes e precisas</span>
              </div>
              <div className={styles.itemInclui}>
                <FileText size={20} />
                <span>Relatórios e exportações</span>
              </div>
              <div className={styles.itemInclui}>
                <Headset size={20} />
                <span>Suporte técnico dedicado</span>
              </div>
            </div>
          </section>
        </div>

        {/* Checkout embutido */}
        <aside className={styles.colunaLateral}>
          <section className={styles.cartaoPagamento}>
            <h2 className={styles.tituloPagamento}>
              <Lock size={16} />
              Pagamento seguro
            </h2>
            <p className={styles.subtituloPagamento}>Ambiente criptografado e confiável</p>

            {!planoSelecionado ? (
              <p className={styles.semSelecao}>Escolha um plano ao lado pra ver o resumo aqui.</p>
            ) : estadoPagamento === 'aprovado' ? (
              <div className={styles.estadoPagamentoBloco}>
                <Check size={28} className={styles.iconeAprovado} />
                <strong>Pagamento aprovado</strong>
                <p>Seu plano foi atualizado para {planoSelecionado.nome}. O recibo foi enviado por e-mail.</p>
              </div>
            ) : (
              <>
                <div className={styles.resumoPlano}>
                  <span className={styles.tituloResumo}>Resumo do plano</span>
                  <div className={styles.linhaResumo}>
                    <span>Plano selecionado</span>
                    <strong>{planoSelecionado.nome}</strong>
                  </div>
                  <div className={styles.linhaResumo}>
                    <span>Valor mensal</span>
                    <strong>R$ {Number(planoSelecionado.preco_mensal).toFixed(2)}</strong>
                  </div>
                  <div className={styles.linhaResumo}>
                    <span>Próxima cobrança</span>
                    <strong>Todo dia 01</strong>
                  </div>
                </div>

                <form className={styles.formPagamento} onSubmit={aoAssinar}>
                  <div className={styles.blocoCartao}>
                    <span className={styles.tituloResumo}>Dados do cartão</span>
                    <div className={styles.bandeiras}>
                      {BANDEIRAS_CARTAO.map((bandeira) => (
                        <span key={bandeira} className={styles.bandeira}>
                          {bandeira}
                        </span>
                      ))}
                    </div>
                  </div>

                  <label className={styles.rotuloCampo}>Número do cartão</label>
                  <input
                    className={styles.campo}
                    placeholder="0000 0000 0000 0000"
                    value={numeroCartao}
                    onChange={(e) => setNumeroCartao(e.target.value)}
                    required
                  />

                  <label className={styles.rotuloCampo}>Nome no cartão</label>
                  <input
                    className={styles.campo}
                    placeholder="Seu nome completo"
                    value={nomeCartao}
                    onChange={(e) => setNomeCartao(e.target.value)}
                    required
                  />

                  <div className={styles.linha2Colunas}>
                    <div>
                      <label className={styles.rotuloCampo}>Validade</label>
                      <input
                        className={styles.campo}
                        placeholder="MM/AA"
                        value={validade}
                        onChange={(e) => setValidade(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className={styles.rotuloCampo}>CVV</label>
                      <input
                        className={styles.campo}
                        placeholder="123"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className={styles.botaoAssinar} disabled={estadoPagamento === 'processando'}>
                    {estadoPagamento === 'processando' ? 'Processando...' : 'Assinar plano'}
                  </button>
                  <p className={styles.termos}>
                    Ao assinar, você concorda com nossos <a href="#termos">Termos de Uso</a> e{' '}
                    <a href="#privacidade">Política de Privacidade</a>.
                  </p>
                </form>
              </>
            )}
          </section>

          <section className={styles.cartaoDuvidas}>
            <HelpCircle size={18} />
            <div>
              <strong>Dúvidas?</strong>
              <span>Fale com nosso suporte</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default GerenciamentoPlano
