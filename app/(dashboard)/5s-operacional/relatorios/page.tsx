import { BarChart3, TrendingUp } from 'lucide-react'

export default function Operational5sReportsPage() {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title flex items-center gap-2">
          <BarChart3 size={16} /> Relatórios de Desempenho 5S
        </span>
      </div>
      <div className="section-card-body p-0">
        <div className="empty-state !m-12">
          <TrendingUp className="empty-state-icon" />
          <h3 className="empty-state-title">Análises e Métricas Indisponíveis</h3>
          <p className="empty-state-description">
            Os relatórios de consistência, evolução e aderência da equipe ao padrão 5S estarão disponíveis após o registro dos primeiros dias operacionais.
          </p>
        </div>
      </div>
    </div>
  )
}
