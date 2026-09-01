import { useState } from 'react'
import { Settings, Bell, Thermometer, Languages, Check } from 'lucide-react'
import styles from './Configuracoes.module.css'

// Preferências ainda são só locais (não persistidas no backend — não há
// endpoint de preferências ainda). Estrutura segue a ficha técnica do PDF
// (2.2.2.4): canais de notificação, unidade de medida, idioma.
function Configuracoes() {
  const [emailAtivo, setEmailAtivo] = useState(true)
  const [dashboardAtivo, setDashboardAtivo] = useState(true)
  const [unidade, setUnidade] = useState('celsius')
  const [idioma, setIdioma] = useState('pt-br')
  const [salvo, setSalvo] = useState(false)

  function aoSalvar() {
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>
        <Settings size={20} />
        Configurações
      </h1>

      <section className={styles.cartao}>
        <h2 className={styles.tituloSecao}>
          <Bell size={16} />
          Canais de notificação
        </h2>
        <div className={styles.linhaToggle}>
          <span>Alertas por e-mail</span>
          <button
            type="button"
            className={`${styles.toggle} ${emailAtivo ? styles.toggleAtivo : ''}`}
            onClick={() => setEmailAtivo((atual) => !atual)}
            aria-pressed={emailAtivo}
          >
            <span className={styles.toggleBolinha} />
          </button>
        </div>
        <div className={styles.linhaToggle}>
          <span>Alertas no dashboard</span>
          <button
            type="button"
            className={`${styles.toggle} ${dashboardAtivo ? styles.toggleAtivo : ''}`}
            onClick={() => setDashboardAtivo((atual) => !atual)}
            aria-pressed={dashboardAtivo}
          >
            <span className={styles.toggleBolinha} />
          </button>
        </div>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.tituloSecao}>
          <Thermometer size={16} />
          Unidade de medida
        </h2>
        <div className={styles.segmentado}>
          <button
            type="button"
            className={`${styles.opcaoSegmentada} ${unidade === 'celsius' ? styles.opcaoSegmentadaAtiva : ''}`}
            onClick={() => setUnidade('celsius')}
          >
            °C
          </button>
          <button
            type="button"
            className={`${styles.opcaoSegmentada} ${unidade === 'fahrenheit' ? styles.opcaoSegmentadaAtiva : ''}`}
            onClick={() => setUnidade('fahrenheit')}
          >
            °F
          </button>
        </div>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.tituloSecao}>
          <Languages size={16} />
          Idioma do sistema
        </h2>
        <select className={styles.select} value={idioma} onChange={(evento) => setIdioma(evento.target.value)}>
          <option value="pt-br">Português (Brasil)</option>
          <option value="en-us">English (US)</option>
        </select>
      </section>

      <button type="button" className={styles.botaoSalvar} onClick={aoSalvar}>
        {salvo ? (
          <>
            <Check size={16} />
            Alterações salvas
          </>
        ) : (
          'Salvar alterações'
        )}
      </button>
    </div>
  )
}

export default Configuracoes
