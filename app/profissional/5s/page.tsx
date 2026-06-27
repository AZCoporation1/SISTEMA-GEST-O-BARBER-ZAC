import { Trophy, CheckSquare } from 'lucide-react'

export default function Professional5sPage() {
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CheckSquare className="text-[var(--accent)]" size={24} /> Meu Desempenho 5S
          </h1>
          <p className="page-subtitle">Acompanhe sua aderência ao padrão operacional IBZ.</p>
        </div>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title flex items-center gap-2">
            <Trophy size={16} /> Resultados Pessoais
          </span>
        </div>
        <div className="section-card-body p-0">
          <div className="empty-state !m-12">
            <Trophy className="empty-state-icon" />
            <h3 className="empty-state-title">Ainda não há resultados 5S disponíveis</h3>
            <p className="empty-state-description">
              O módulo operacional está em fase de preparação. Assim que a barbearia ativar os registros diários, você poderá acompanhar sua pontuação e consistência técnica por aqui.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
