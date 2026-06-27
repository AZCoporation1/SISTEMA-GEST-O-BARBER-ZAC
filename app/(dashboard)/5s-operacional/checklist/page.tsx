import { getTemplateItemsByStage, Operational5sStage } from '@/features/operational-5s/config/official5sTemplate'
import { CheckSquare } from 'lucide-react'

export default function Operational5sChecklistPage() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Checklist 5S (O Padrão IBZ)</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Este é o padrão de excelência de 21 itens do Instituto Barber Zac. Durante a fase de preparação, estes itens são exibidos no estado neutro (Pendente) e as ações interativas estão desabilitadas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StageColumn stage="ABERTURA" title="Abertura" />
        <StageColumn stage="DURANTE_O_DIA" title="Durante o Dia" />
        <StageColumn stage="FECHAMENTO" title="Fechamento" />
      </div>
    </div>
  )
}

function StageColumn({ stage, title }: { stage: Operational5sStage, title: string }) {
  const items = getTemplateItemsByStage(stage)

  return (
    <div className="section-card h-fit">
      <div className="section-card-header">
        <span className="section-card-title flex items-center gap-2">
          {title}
        </span>
      </div>
      <div className="section-card-body p-0">
        <div className="flex flex-col">
          {items.map((item, i) => (
            <div key={item.id} className={`p-4 ${i !== items.length - 1 ? 'border-b border-[var(--border)]' : ''}`}>
              <div className="flex items-start gap-3">
                <button
                  disabled
                  title="Ação disponível após a ativação segura do banco 5S."
                  className="mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded border border-[var(--border-strong)] bg-[var(--bg-base)] cursor-not-allowed opacity-50 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {/* Empty state for checkbox */}
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[var(--text-primary)] leading-tight opacity-70">
                    {item.label}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--warning)] mt-1.5 opacity-80">
                    Pendente
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
