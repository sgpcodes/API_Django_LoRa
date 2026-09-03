import { useState } from 'react'
import { ChevronDown, ChevronUp, Mail, Phone, Radio, UserRound } from 'lucide-react'
import styles from './ContaAdminCard.module.css'

function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function iniciais(nome) {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/)
  return partes
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

// Card de uma conta na tela de Contas do admin — mesmo padrão "recolhido
// por padrão, Detalhes expande" das outras telas (Dados do LoRa /
// Estações). Expandido, mostra os dados completos da pessoa, as estações
// que ela já tem e — se houver sensor sem dono disponível — o seletor
// rápido pra atribuir uma estação a ela, sem sair do card.
function ContaAdminCard({ conta, estacoesDaConta, sensoresOrfaos, atribuindo, erro, onAtribuir }) {
  const [detalhesAbertos, setDetalhesAbertos] = useState(false)
  const [sensorEscolhido, setSensorEscolhido] = useState('')

  const nome = conta.first_name || conta.username
  const limite = conta.plano_max_estacoes
  const noLimite = limite != null && conta.estacoes_vinculadas >= limite

  function aoAtribuir(evento) {
    evento.preventDefault()
    if (!sensorEscolhido) return
    onAtribuir(sensorEscolhido)
    setSensorEscolhido('')
  }

  return (
    <div className={styles.card}>
      <div className={styles.topo}>
        <div className={styles.identificacao}>
          <div className={styles.avatar}>{iniciais(nome)}</div>
          <div>
            <div className={styles.nomeLinha}>
              <span className={styles.nome}>{nome}</span>
              <span className={styles.planoPill}>{conta.plano_atual ?? 'Sem plano'}</span>
              <span className={`${styles.statusPill} ${conta.is_active ? styles.statusAtiva : styles.statusSuspensa}`}>
                {conta.is_active ? 'Ativa' : 'Suspensa'}
              </span>
            </div>
            <span className={styles.subtexto}>
              {conta.email || conta.username} · {conta.estacoes_vinculadas} de {limite ?? '∞'} estação(ões)
            </span>
          </div>
        </div>

        <button type="button" className={styles.botaoDetalhes} onClick={() => setDetalhesAbertos((a) => !a)}>
          {detalhesAbertos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {detalhesAbertos ? 'Ocultar detalhes' : 'Detalhes'}
        </button>
      </div>

      {detalhesAbertos && (
        <div className={styles.detalhes}>
          <div className={styles.infoGrid}>
            <div className={styles.infoCampo}>
              <span className={styles.infoRotulo}>
                <Mail size={12} /> E-mail
              </span>
              <span className={styles.infoValor}>{conta.email || '—'}</span>
            </div>
            <div className={styles.infoCampo}>
              <span className={styles.infoRotulo}>
                <Phone size={12} /> Telefone
              </span>
              <span className={styles.infoValor}>{conta.telefone || '—'}</span>
            </div>
            <div className={styles.infoCampo}>
              <span className={styles.infoRotulo}>
                <UserRound size={12} /> Usuário
              </span>
              <span className={styles.infoValor}>{conta.username}</span>
            </div>
            <div className={styles.infoCampo}>
              <span className={styles.infoRotulo}>Membro desde</span>
              <span className={styles.infoValor}>{formatarData(conta.date_joined)}</span>
            </div>
          </div>

          <div className={styles.secaoEstacoes}>
            <span className={styles.secaoTitulo}>
              <Radio size={13} /> Estações vinculadas
            </span>
            {estacoesDaConta.length === 0 ? (
              <p className={styles.semEstacoes}>Nenhuma estação vinculada ainda.</p>
            ) : (
              <ul className={styles.listaEstacoes}>
                {estacoesDaConta.map((estacao) => (
                  <li key={estacao.id} className={styles.itemEstacao}>
                    <span>{estacao.nome || estacao.identificador}</span>
                    <span className={`${styles.statusPill} ${estacao.esta_offline ? styles.statusSuspensa : styles.statusAtiva}`}>
                      {estacao.esta_offline ? 'Offline' : 'Online'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className={styles.formAtribuir} onSubmit={aoAtribuir}>
            <label className={styles.infoRotulo} htmlFor={`sensor-${conta.id}`}>
              Atribuir estação
            </label>
            <div className={styles.linhaAtribuir}>
              <select
                id={`sensor-${conta.id}`}
                className={styles.seletor}
                value={sensorEscolhido}
                onChange={(evento) => setSensorEscolhido(evento.target.value)}
                disabled={noLimite || sensoresOrfaos.length === 0}
              >
                <option value="">
                  {sensoresOrfaos.length === 0 ? 'Nenhum sensor sem dono no momento' : 'Selecione um sensor...'}
                </option>
                {sensoresOrfaos.map((orfao) => (
                  <option key={orfao.sensor_id} value={orfao.sensor_id}>
                    {orfao.sensor_id}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className={styles.botaoAtribuir}
                disabled={!sensorEscolhido || atribuindo || noLimite}
              >
                {atribuindo ? 'Atribuindo...' : 'Atribuir'}
              </button>
            </div>
            {noLimite && <p className={styles.aviso}>Limite de estações do plano atingido.</p>}
            {erro && <p className={styles.aviso}>{erro}</p>}
          </form>
        </div>
      )}
    </div>
  )
}

export default ContaAdminCard
