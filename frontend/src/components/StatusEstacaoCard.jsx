import { CheckCircle2, AlertTriangle, Gauge } from 'lucide-react'
import styles from './StatusEstacaoCard.module.css'

// Card "Status da estação" — operacional/atenção, conforme RN17 (estação
// offline). Enquanto os dados vêm da API externa (não da estação LoRa de
// verdade), o status fica sempre operacional.
function StatusEstacaoCard({ operacional = true }) {
  return (
    <div className={styles.container}>
      <h2 className={styles.titulo}>
        <Gauge size={18} />
        Status da estação
      </h2>

      <div className={`${styles.selo} ${operacional ? styles.seloOk : styles.seloAlerta}`}>
        {operacional ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        <span>{operacional ? 'Operacional' : 'Atenção'}</span>
      </div>

      <p className={styles.texto}>
        {operacional
          ? 'Todos os sensores estão funcionando normalmente.'
          : 'Alguns sensores podem estar offline ou sem enviar dados recentes.'}
      </p>
    </div>
  )
}

export default StatusEstacaoCard
