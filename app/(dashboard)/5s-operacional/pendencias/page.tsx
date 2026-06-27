import { AlertTriangle, Clock } from 'lucide-react'

export default function Operational5sPendenciesPage() {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title flex items-center gap-2">
          <AlertTriangle size={16} /> Gestão de Pendências 5S
        </span>
      </div>
      <div className="section-card-body p-0">
        <div className="empty-state !m-12">
          <Clock className="empty-state-icon" />
          <h3 className="empty-state-title">Nenhuma pendência digital</h3>
          <p className="empty-state-description">
            As pendências operacionais reportadas (como equipamentos quebrados, lâmpadas queimadas ou produtos em falta) aparecerão aqui após a ativação segura do banco 5S.
          </p>
          <div className="mt-6 flex items-center justify-center">
            <button disabled className="btn-primary opacity-50 cursor-not-allowed" title="Ação disponível após a ativação segura do banco 5S.">
              + Registrar Nova Pendência
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
