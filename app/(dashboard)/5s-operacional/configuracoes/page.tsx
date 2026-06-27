import { Settings, Save } from 'lucide-react'

export default function Operational5sSettingsPage() {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <span className="section-card-title flex items-center gap-2">
          <Settings size={16} /> Configurações do Módulo 5S
        </span>
      </div>
      <div className="section-card-body">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Configure o responsável operacional padrão, horários de notificação e o impacto da gamificação. A edição estará disponível após a ativação.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)] block">Gerente Padrão (Fechamento)</label>
              <select disabled className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg p-2.5 opacity-50 cursor-not-allowed">
                <option>Selecione um administrador...</option>
              </select>
              <p className="text-xs text-[var(--text-muted)]">O usuário responsável por validar as pendências ao final do dia.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)] block">Lembrete de Abertura</label>
              <input type="time" disabled value="08:30" className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg p-2.5 opacity-50 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)] block">Lembrete de Fechamento</label>
              <input type="time" disabled value="20:00" className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg p-2.5 opacity-50 cursor-not-allowed" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--text-primary)] block">Multiplicador Gamificação (Score 5S)</label>
              <input type="number" disabled value="1" className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg p-2.5 opacity-50 cursor-not-allowed" />
              <p className="text-xs text-[var(--text-muted)]">Peso do score 5S no cálculo de pontos de experiência (XP) da barbearia.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)]">
            <button disabled className="btn-primary opacity-50 cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2" title="Ação disponível após a ativação segura do banco 5S.">
              <Save size={16} />
              Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
