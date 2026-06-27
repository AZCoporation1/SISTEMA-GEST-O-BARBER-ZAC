import { Clock, History } from 'lucide-react'

export default function Operational5sHistoryPage() {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title flex items-center gap-2">
          <History size={16} /> Histórico de Auditorias 5S
        </span>
      </div>
      <div className="section-card-body p-0">
        <div className="empty-state !m-12">
          <Clock className="empty-state-icon" />
          <h3 className="empty-state-title">Sem histórico disponível</h3>
          <p className="empty-state-description">
            O histórico digital das avaliações e relatórios diários de 5S será construído a partir do momento em que o módulo for liberado para operação real.
          </p>
        </div>
      </div>
    </div>
  )
}
