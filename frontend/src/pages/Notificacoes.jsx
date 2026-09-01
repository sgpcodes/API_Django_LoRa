import { useState } from 'react'
import { Bell, CloudRain, Wifi, CreditCard, Check, Trash2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './Notificacoes.module.css'

// Dados de exemplo — ainda não existe endpoint de notificações no backend.
// Estrutura já segue o que o PDF pede (tipo, lida/não lida, data), só
// trocar por uma chamada de API quando o endpoint existir.
const NOTIFICACOES_EXEMPLO = [
  {
    id: 1,
    tipo: 'clima',
    titulo: 'Risco de geada esta noite',
    descricao: 'Temperatura prevista abaixo de 3°C entre 3h e 6h.',
    dataHora: '2026-08-31T18:20:00',
    lida: false,
  },
  {
    id: 2,
    tipo: 'sistema',
    titulo: 'Estação offline por 12 minutos',
    descricao: 'ESP32_01 ficou sem enviar dados entre 14:03 e 14:15.',
    dataHora: '2026-08-31T14:15:00',
    lida: false,
  },
  {
    id: 3,
    tipo: 'conta',
    titulo: 'Bem-vindo ao plano Standard',
    descricao: 'Sua conta foi criada com sucesso. Aproveite o histórico de 30 dias.',
    dataHora: '2026-08-25T09:00:00',
    lida: true,
  },
]

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'clima', rotulo: 'Clima' },
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'conta', rotulo: 'Conta' },
]

const ICONE_POR_TIPO = { clima: CloudRain, sistema: Wifi, conta: CreditCard }

function formatarDataHora(dataHoraISO) {
  return new Date(dataHoraISO).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Tela de Notificações (2.2.2.2 do PDF): lista cronológica de alertas
// climáticos, operacionais e de conta, com filtro por tipo e indicador de
// lida/não lida.
function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState(NOTIFICACOES_EXEMPLO)
  const [filtro, setFiltro] = useState('todos')

  const visiveis = notificacoes.filter((notificacao) => filtro === 'todos' || notificacao.tipo === filtro)

  function marcarComoLida(id) {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  }

  function excluir(id) {
    setNotificacoes((atual) => atual.filter((n) => n.id !== id))
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>
          <Bell size={20} />
          Notificações
        </h1>
        <Link to="/app/configuracoes" className={styles.linkPreferencias}>
          <Settings size={14} />
          Preferências de notificação
        </Link>
      </div>

      <div className={styles.filtros}>
        {FILTROS.map((item) => (
          <button
            key={item.valor}
            type="button"
            className={`${styles.filtro} ${filtro === item.valor ? styles.filtroAtivo : ''}`}
            onClick={() => setFiltro(item.valor)}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className={styles.vazio}>Nenhuma notificação por aqui.</p>
      ) : (
        <ul className={styles.lista}>
          {visiveis.map((notificacao) => {
            const Icone = ICONE_POR_TIPO[notificacao.tipo] ?? Bell
            return (
              <li
                key={notificacao.id}
                className={`${styles.item} ${notificacao.lida ? '' : styles.itemNaoLido}`}
              >
                <span className={styles.iconeItem}>
                  <Icone size={16} />
                </span>
                <div className={styles.conteudoItem}>
                  <span className={styles.tituloItem}>{notificacao.titulo}</span>
                  <span className={styles.descricaoItem}>{notificacao.descricao}</span>
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
    </div>
  )
}

export default Notificacoes
