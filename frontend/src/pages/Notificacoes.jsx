import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  Bell,
  Settings2,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Snowflake,
  WifiOff,
  CheckCircle2,
  CloudRain,
  Thermometer,
  Lightbulb,
  SlidersHorizontal,
  BellRing,
  History,
  Radio,
} from 'lucide-react'
import styles from './Notificacoes.module.css'

// Dados de exemplo — ainda não existe endpoint de notificações no backend.
// Estrutura já segue o que o PDF pede (tipo, lida/não lida, data); `cor`
// é a urgência/tom de cada alerta (nem todo alerta de clima é "grave", por
// isso não é derivada automaticamente do `tipo`). Trocar por uma chamada
// de API quando o endpoint existir.
const NOTIFICACOES_EXEMPLO = [
  {
    id: 1,
    tipo: 'clima',
    cor: 'azul',
    icone: Snowflake,
    titulo: 'Risco de geada esta noite',
    descricao: 'Temperatura prevista abaixo de 3°C entre 3h e 6h.',
    dataHora: '2026-08-31T18:20:00',
    lida: false,
  },
  {
    id: 2,
    tipo: 'sistema',
    cor: 'laranja',
    icone: WifiOff,
    titulo: 'Estação offline por 12 minutos',
    descricao: 'ESP32_01 ficou sem enviar dados entre 14:03 e 14:15.',
    dataHora: '2026-08-31T14:15:00',
    lida: false,
  },
  {
    id: 3,
    tipo: 'conta',
    cor: 'verde',
    icone: CheckCircle2,
    titulo: 'Bem-vindo ao plano Standard',
    descricao: 'Sua conta foi criada com sucesso. Aproveite o histórico de 30 dias.',
    dataHora: '2026-08-25T09:00:00',
    lida: true,
  },
  {
    id: 4,
    tipo: 'clima',
    cor: 'azul',
    icone: CloudRain,
    titulo: 'Previsão de chuva intensa',
    descricao: 'Há previsão de chuva intensa nas próximas 24 horas.',
    dataHora: '2026-08-24T16:45:00',
    lida: false,
  },
  {
    id: 5,
    tipo: 'clima',
    cor: 'vermelho',
    icone: Thermometer,
    titulo: 'Temperatura acima da média',
    descricao: 'A temperatura atual está 2.3°C acima da média para hoje.',
    dataHora: '2026-08-24T11:30:00',
    lida: false,
  },
  {
    id: 6,
    tipo: 'sistema',
    cor: 'laranja',
    icone: WifiOff,
    titulo: 'Atualização de firmware disponível',
    descricao: 'Uma nova versão do firmware da estação está disponível.',
    dataHora: '2026-08-22T10:00:00',
    lida: true,
  },
  {
    id: 7,
    tipo: 'conta',
    cor: 'verde',
    icone: CheckCircle2,
    titulo: 'Pagamento confirmado',
    descricao: 'Recebemos a confirmação de pagamento da sua assinatura.',
    dataHora: '2026-08-20T08:15:00',
    lida: false,
  },
]

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'clima', rotulo: 'Clima' },
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'conta', rotulo: 'Conta' },
]

const RES_POR_TIPO = {
  clima: { rotulo: 'Clima', cor: '#3b82f6' },
  sistema: { rotulo: 'Sistema', cor: '#f59e0b' },
  conta: { rotulo: 'Conta', cor: '#22c55e' },
}

const ITENS_POR_PAGINA = 5

function formatarDataHora(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Tela de Notificações (2.2.2.2 do PDF): lista cronológica de alertas
// climáticos, operacionais e de conta, com filtro por tipo, indicador de
// lida/não lida e um resumo lateral (contagem por tipo + dicas).
function Notificacoes() {
  const navigate = useNavigate()
  const [notificacoes, setNotificacoes] = useState(NOTIFICACOES_EXEMPLO)
  const [filtro, setFiltro] = useState('todos')
  const [pagina, setPagina] = useState(1)

  const visiveis = notificacoes.filter((notificacao) => filtro === 'todos' || notificacao.tipo === filtro)
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / ITENS_POR_PAGINA))
  const inicio = (pagina - 1) * ITENS_POR_PAGINA
  const paginaAtual = visiveis.slice(inicio, inicio + ITENS_POR_PAGINA)

  const resumo = useMemo(() => {
    const contagem = { clima: 0, sistema: 0, conta: 0, naoLidas: 0 }
    notificacoes.forEach((n) => {
      contagem[n.tipo] += 1
      if (!n.lida) contagem.naoLidas += 1
    })
    return contagem
  }, [notificacoes])

  const dadosDonut = ['clima', 'sistema', 'conta']
    .map((tipo) => ({ tipo, valor: resumo[tipo], cor: RES_POR_TIPO[tipo].cor }))
    .filter((fatia) => fatia.valor > 0)

  function mudarFiltro(valor) {
    setFiltro(valor)
    setPagina(1)
  }

  function marcarComoLida(id) {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  }

  function marcarTodasComoLidas() {
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })))
  }

  function excluirLidas() {
    setNotificacoes((atual) => atual.filter((n) => !n.lida))
    setPagina(1)
  }

  function excluir(id) {
    setNotificacoes((atual) => atual.filter((n) => n.id !== id))
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>
            <Bell size={22} />
            Notificações
          </h1>
          <p className={styles.subtitulo}>Acompanhe todos os alertas e atualizações do seu sistema.</p>
        </div>
        <button type="button" className={styles.botaoPreferencias} onClick={() => navigate('/app/configuracoes')}>
          <Settings2 size={15} />
          Preferências de notificação
        </button>
      </div>

      <div className={styles.grade}>
        <div className={styles.colunaPrincipal}>
          <div className={styles.barraFiltros}>
            <div className={styles.filtros}>
              {FILTROS.map((item) => {
                const contagem = item.valor === 'todos' ? notificacoes.length : resumo[item.valor]
                return (
                  <button
                    key={item.valor}
                    type="button"
                    className={`${styles.filtro} ${filtro === item.valor ? styles.filtroAtivo : ''}`}
                    onClick={() => mudarFiltro(item.valor)}
                  >
                    {item.rotulo}
                    <span className={styles.contadorFiltro}>{contagem}</span>
                  </button>
                )
              })}
            </div>
            <div className={styles.acoesBarra}>
              <button type="button" className={styles.botaoSecundario} onClick={marcarTodasComoLidas}>
                <Check size={14} />
                Marcar todas como lidas
              </button>
              <button type="button" className={styles.botaoExcluir} onClick={excluirLidas}>
                <Trash2 size={14} />
                Excluir lidas
              </button>
            </div>
          </div>

          {paginaAtual.length === 0 ? (
            <p className={styles.vazio}>Nenhuma notificação por aqui.</p>
          ) : (
            <ul className={styles.lista}>
              {paginaAtual.map((notificacao) => {
                const Icone = notificacao.icone ?? Bell
                return (
                  <li
                    key={notificacao.id}
                    className={`${styles.item} ${styles[`corBorda${notificacao.cor}`]} ${notificacao.lida ? '' : styles.itemNaoLido}`}
                  >
                    <span className={`${styles.iconeItem} ${styles[`corIcone${notificacao.cor}`]}`}>
                      <Icone size={18} />
                    </span>
                    <div className={styles.conteudoItem}>
                      <div className={styles.linhaTitulo}>
                        {!notificacao.lida && <span className={styles.pontoNaoLido} />}
                        <span className={styles.tituloItem}>{notificacao.titulo}</span>
                        <span className={styles.badgeTipo}>{RES_POR_TIPO[notificacao.tipo].rotulo}</span>
                      </div>
                      <p className={styles.descricaoItem}>{notificacao.descricao}</p>
                      <span className={styles.dataItem}>{formatarDataHora(notificacao.dataHora)}</span>
                    </div>
                    <div className={styles.acoesItem}>
                      {!notificacao.lida && (
                        <button
                          type="button"
                          className={styles.botaoIcone}
                          title="Marcar como lida"
                          onClick={() => marcarComoLida(notificacao.id)}
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.botaoIcone}
                        title="Excluir"
                        onClick={() => excluir(notificacao.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {totalPaginas > 1 && (
            <div className={styles.paginacao}>
              <button
                type="button"
                className={styles.botaoPagina}
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
                disabled={pagina === 1}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
                <button
                  key={numero}
                  type="button"
                  className={`${styles.numeroPagina} ${pagina === numero ? styles.numeroPaginaAtivo : ''}`}
                  onClick={() => setPagina(numero)}
                >
                  {numero}
                </button>
              ))}
              <button
                type="button"
                className={styles.botaoPagina}
                onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))}
                disabled={pagina === totalPaginas}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <aside className={styles.colunaLateral}>
          <section className={styles.cartaoLateral}>
            <h2 className={styles.tituloLateral}>
              <BellRing size={16} />
              Resumo de notificações
            </h2>
            <div className={styles.blocoDonut}>
              <div className={styles.donutWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosDonut.length ? dadosDonut : [{ tipo: 'vazio', valor: 1, cor: '#e6ebf5' }]}
                      dataKey="valor"
                      nameKey="tipo"
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={54}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                    >
                      {(dadosDonut.length ? dadosDonut : [{ cor: '#e6ebf5' }]).map((fatia, indice) => (
                        <Cell key={indice} fill={fatia.cor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCentro}>
                  <span className={styles.donutTotal}>{notificacoes.length}</span>
                  <span className={styles.donutRotulo}>Total</span>
                </div>
              </div>
              <ul className={styles.legendaDonut}>
                {['clima', 'sistema', 'conta'].map((tipo) => (
                  <li key={tipo}>
                    <span className={styles.pontoLegenda} style={{ backgroundColor: RES_POR_TIPO[tipo].cor }} />
                    {RES_POR_TIPO[tipo].rotulo}
                    <strong>{resumo[tipo]}</strong>
                  </li>
                ))}
                <li>
                  <span className={styles.pontoLegenda} style={{ backgroundColor: '#8b5cf6' }} />
                  Não lidas
                  <strong>{resumo.naoLidas}</strong>
                </li>
              </ul>
            </div>
          </section>

          <section className={styles.cartaoLateral}>
            <h2 className={styles.tituloLateral}>
              <Lightbulb size={16} />
              Dicas rápidas
            </h2>
            <ul className={styles.listaDicas}>
              <li>
                <SlidersHorizontal size={16} />
                <div>
                  <strong>Organize suas notificações</strong>
                  <p>Use os filtros acima para visualizar apenas os tipos de notificação que deseja.</p>
                </div>
              </li>
              <li>
                <Settings2 size={16} />
                <div>
                  <strong>Personalize alertas</strong>
                  <p>Configure suas preferências para receber apenas o que é importante.</p>
                </div>
              </li>
              <li>
                <BellRing size={16} />
                <div>
                  <strong>Mantenha-se informada</strong>
                  <p>Verifique regularmente os alertas para agir rapidamente.</p>
                </div>
              </li>
            </ul>
          </section>

          <section className={styles.cartaoLateral}>
            <h2 className={styles.tituloLateral}>Atalhos úteis</h2>
            <div className={styles.listaAtalhos}>
              <button type="button" className={styles.botaoAtalho} onClick={() => navigate('/app/perfil')}>
                <History size={15} />
                Ver histórico de acessos
                <ChevronRight size={14} className={styles.chevronAtalho} />
              </button>
              <button type="button" className={styles.botaoAtalho} onClick={() => navigate('/app')}>
                <Radio size={15} />
                Verificar status da estação
                <ChevronRight size={14} className={styles.chevronAtalho} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default Notificacoes
