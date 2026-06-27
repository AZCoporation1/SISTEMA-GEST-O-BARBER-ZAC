import { KPICard } from '@/components/ui/kpi-card'
import { Calendar, User, Trophy, ShieldCheck, Info, CheckSquare, ClipboardCheck, AlertTriangle } from 'lucide-react'

export default function Operational5sOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Intro Box */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 mb-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Info className="text-[var(--accent)]" size={20} />
          Sobre a Ativação do Módulo
        </h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-4xl">
          A estrutura visual e o padrão IBZ estão prontos. O registro digital será ativado após a conclusão controlada da camada de banco.
          Nenhuma ação real pode ser realizada neste momento. Os painéis e métricas abaixo refletem estados vazios que serão populados assim que o módulo for liberado para operação real.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <KPICard
          title="Data Operacional"
          value="--/--/----"
          description="Aguardando ativação operacional"
          icon={<Calendar size={16} />}
        />
        <KPICard
          title="Gerente Padrão"
          value="Pendente"
          description="Responsável operacional padrão"
          icon={<User size={16} />}
        />
        <KPICard
          title="Status do Dia"
          value="Não Iniciado"
          description="Sem registros digitais ainda"
          icon={<ShieldCheck size={16} />}
        />
        <KPICard
          title="Score 5S"
          value="--%"
          description="Dados exibidos após ativação"
          icon={<Trophy size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full">
        {/* Fluxo Diário */}
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title flex items-center gap-2">
              <ClipboardCheck size={16} /> Fluxo Operacional
            </span>
          </div>
          <div className="section-card-body">
            <div className="relative pl-6 border-l-2 border-[var(--border-strong)] space-y-8 py-2">
              {/* Etapa 1 */}
              <div className="relative">
                <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[var(--bg-base)] border-2 border-[var(--border-strong)] flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">1. Abertura</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 mb-3">Preparação da barbearia antes do primeiro cliente.</p>
                <button disabled className="px-4 py-2 text-xs font-semibold rounded bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]" title="Ação disponível após a ativação segura do banco 5S.">
                  INICIAR ABERTURA
                </button>
              </div>

              {/* Etapa 2 */}
              <div className="relative">
                <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[var(--bg-base)] border-2 border-[var(--border-strong)] flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">2. Durante o Dia</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 mb-3">Conferências contínuas para manutenção do padrão.</p>
                <button disabled className="px-4 py-2 text-xs font-semibold rounded bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]" title="Ação disponível após a ativação segura do banco 5S.">
                  REGISTRAR CONFERÊNCIA
                </button>
              </div>

              {/* Etapa 3 */}
              <div className="relative">
                <div className="absolute -left-[35px] w-6 h-6 rounded-full bg-[var(--bg-base)] border-2 border-[var(--border-strong)] flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">3. Fechamento e Aprovação</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 mb-3">Limpeza final, auditoria de pendências e aprovação do gerente.</p>
                <div className="flex gap-2 flex-wrap">
                  <button disabled className="px-4 py-2 text-xs font-semibold rounded bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]" title="Ação disponível após a ativação segura do banco 5S.">
                    INICIAR FECHAMENTO
                  </button>
                  <button disabled className="px-4 py-2 text-xs font-semibold rounded bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]" title="Ação disponível após a ativação segura do banco 5S.">
                    VALIDAR PENDÊNCIAS
                  </button>
                  <button disabled className="px-4 py-2 text-xs font-semibold rounded bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border)]" title="Ação disponível após a ativação segura do banco 5S.">
                    APROVAR DIA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Pendências Card */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <AlertTriangle size={16} /> Pendências do Dia
              </span>
            </div>
            <div className="section-card-body p-0">
              <div className="empty-state !m-4">
                <AlertTriangle className="empty-state-icon" />
                <h3 className="empty-state-title">Sem registros</h3>
                <p className="empty-state-description">Aguardando ativação operacional</p>
              </div>
            </div>
          </div>

          {/* Gamificação Integration */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title flex items-center gap-2">
                <Trophy size={16} /> Integração Gamificação
              </span>
            </div>
            <div className="section-card-body">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Contribuição à Gamificação: <span className="text-[var(--warning)] tracking-wider uppercase text-xs">Em preparação</span>
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                O 5S reforça disciplina, padrão e consistência operacional. Ele não altera remuneração financeira nesta fase e servirá futuramente como multiplicador de pontuação de equipe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
