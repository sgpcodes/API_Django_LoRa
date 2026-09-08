import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import {
  Bell,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Radio,
  UserRoundCog,
  UserPlus,
  AlertTriangle,
  Lightbulb,
  Users,
  BellRing,
  ClipboardList,
} from 'lucide-react'
import StatusMessage from '../components/StatusMessage'
import { buscarAuditoriaRecente } from '../services/auditoriaService'
import { buscarContas } from '../services/contasAdminService'
import styles from './Notificacoes.module.css'

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'estacao', rotulo: 'Estações' },
  { valor: 'conta', rotulo: 'Contas' },
  { valor: 'pendencia', rotulo: 'Pendências' },
]

const RES_POR_TIPO = {
  estacao: { rotulo: 'Estação', cor: '#3b82f6' },
  conta: { rotulo: 'Conta', cor: '#22c55e' },
  pendencia: { rotulo: 'Pendência', cor: '#f59e0b' },
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

// Monta a lista de notificações a partir de dado real (nada de mock):
// eventos de auditoria (estação cadastrada / usuários alterados) viram
// notificações "estacao"; contas recém-criadas viram "conta"; contas sem
// nenhuma estação vinculada viram um lembrete "pendencia" (a mensagem
// pra atribuir estação à conta nova).
function construirNotificacoes(auditoria, contas) {
  const nomeConta = (id) => {
    const conta = contas.find((c) => c.id === id)
    return conta ? conta.first_name || conta.username : `conta #${id}`
  }

  const deAuditoria = auditoria.map((evento) => {
    if (evento.acao === 'estacao.criada') {
      const nomes = (evento.detalhes.usuarios_ids ?? []).map(nomeConta)
      return {
        id: `audit-${evento.id}`,
        tipo: 'estacao',
        cor: 'azul',
        icone: Radio,
        titulo: `Estação ${evento.detalhes.identificador} cadastrada`,
        descricao: nomes.length ? `Vinculada a ${nomes.join(', ')}.` : 'Cadastrada sem nenhuma conta vinculada ainda.',
        dataHora: evento.criado_em,
        lida: false,
      }
    }
    const antes = new Set(evento.detalhes.usuarios_antes ?? [])
    const depois = new Set(evento.detalhes.usuarios_depois ?? [])
    const adicionadas = [...depois].filter((id) => !antes.has(id)).map(nomeConta)
    const removidas = [...antes].filter((id) => !depois.has(id)).map(nomeConta)
    const partes = []
    if (adicionadas.length) partes.push(`Adicionada(s): ${adicionadas.join(', ')}`)
    if (removidas.length) partes.push(`Removida(s): ${removidas.join(', ')}`)
    return {
      id: `audit-${evento.id}`,
      tipo: 'estacao',
      cor: 'azul',
      icone: UserRoundCog,
      titulo: `Contas vinculadas à estação ${evento.detalhes.identificador} mudaram`,
      descricao: partes.length ? partes.join(' · ') : 'A lista de contas vinculadas foi atualizada.',
      dataHora: evento.criado_em,
      lida: false,
    }
  })

  const deContas = [...contas]
    .sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined))
    .slice(0, 15)
    .map((conta) => ({
      id: `conta-${conta.id}`,
      tipo: 'conta',
      cor: 'verde',
      icone: UserPlus,
      titulo: `Nova conta cadastrada: ${conta.first_name || conta.username}`,
      descricao: `${conta.plano_atual ?? 'Sem plano'} · ${conta.email}`,
      dataHora: conta.date_joined,
      lida: false,
    }))

  const pendentes = contas
    .filter((conta) => !conta.estacoes_vinculadas)
    .map((conta) => ({
      id: `pendencia-${conta.id}`,
      tipo: 'pendencia',
      cor: 'laranja',
      icone: AlertTriangle,
      titulo: `Atribua uma estação a ${conta.first_name || conta.username}`,
      descricao: 'Essa conta ainda não tem nenhuma estação vinculada.',
      dataHora: conta.date_joined,
      lida: false,
    }))

  return [...deAuditoria, ...deContas, ...pendentes].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora))
}

// Tela de Notificações do Gestor — mesmo design da versão do Usuário
// (Notificacoes.jsx), mas com dado real do painel administrativo em vez
// de exemplo: estações cadastradas/reatribuídas (auditoria), contas
// novas e contas ainda sem estação vinculada.
function NotificacoesAdmin() {
  const navigate = useNavigate()
  const [notificacoes, setNotificacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    Promise.all([buscarAuditoriaRecente(), buscarContas()])
      .then(([auditoria, contas]) => setNotificacoes(construirNotificacoes(auditoria, contas)))
      .catch(() => setErro('Não foi possível carregar as notificações agora.'))
      .finally(() => setCarregando(false))
  }, [])

  const visiveis = notificacoes.filter((notificacao) => filtro === 'todos' || notificacao.tipo === filtro)
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / ITENS_POR_PAGINA))
  const inicio = (pagina - 1) * ITENS_POR_PAGINA
  const paginaAtual = visiveis.slice(inicio, inicio + ITENS_POR_PAGINA)

  const resumo = useMemo(() => {
    const contagem = { estacao: 0, conta: 0, pendencia: 0, naoLidas: 0 }
    notificacoes.forEach((n) => {
      contagem[n.tipo] += 1
      if (!n.lida) contagem.naoLidas += 1
    })
    return contagem
  }, [notificacoes])

  const dadosDonut = ['estacao', 'conta', 'pendencia']
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

  if (carregando) {
    return (
      <div className={styles.pagina}>
        <StatusMessage texto="Carregando notificações..." />
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
            <Bell size={22} />
            Notificações
          </h1>
          <p className={styles.subtitulo}>Estações cadastradas, contas novas e pendências de atribuição.</p>
        </div>
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
                {['estacao', 'conta', 'pendencia'].map((tipo) => (
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
                <AlertTriangle size={16} />
                <div>
                  <strong>Atenda as pendências primeiro</strong>
                  <p>Contas sem estação vinculada ficam sem dados até você atribuir uma.</p>
                </div>
              </li>
              <li>
                <UserRoundCog size={16} />
                <div>
                  <strong>Acompanhe mudanças de vínculo</strong>
                  <p>Toda troca de contas numa estação aparece aqui, com quem entrou e quem saiu.</p>
                </div>
              </li>
              <li>
                <ClipboardList size={16} />
                <div>
                  <strong>Use os filtros</strong>
                  <p>Separe estações, contas novas e pendências pra revisar mais rápido.</p>
                </div>
              </li>
            </ul>
          </section>

          <section className={styles.cartaoLateral}>
            <h2 className={styles.tituloLateral}>Atalhos úteis</h2>
            <div className={styles.listaAtalhos}>
              <button type="button" className={styles.botaoAtalho} onClick={() => navigate('/app/adm/contas')}>
                <Users size={15} />
                Ver contas
                <ChevronRight size={14} className={styles.chevronAtalho} />
              </button>
              <button type="button" className={styles.botaoAtalho} onClick={() => navigate('/app/adm/estacoes')}>
                <Radio size={15} />
                Ver estações
                <ChevronRight size={14} className={styles.chevronAtalho} />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default NotificacoesAdmin
