"use client"

/**
 * Barber Zac ERP — Subscription Usage Progress Bar
 * Shows visual progress of visits used in the current cycle.
 * e.g. 2/4 usadas with a gradient progress bar
 */

interface SubscriptionUsageBarProps {
  used: number
  total: number
  compact?: boolean
}

export default function SubscriptionUsageBar({ used, total, compact = false }: SubscriptionUsageBarProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const isComplete = used >= total

  // Tailwind equivalent classes for background gradients
  const barClasses = isComplete
    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
    : pct > 50
      ? 'bg-gradient-to-r from-amber-500 to-amber-600'
      : 'bg-gradient-to-r from-purple-500 to-indigo-500'

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barClasses}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-[11px] font-bold ${isComplete ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          {used}/{total}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Uso do Ciclo
        </span>
        <span className={`text-sm font-bold ${isComplete ? 'text-emerald-500' : 'text-purple-500'}`}>
          {used}/{total} {isComplete ? '✓ Completo' : 'usadas'}
        </span>
      </div>
      
      <div className="w-full h-2 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barClasses}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      
      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
        <span>Restantes: {Math.max(0, total - used)}</span>
        <span>{isComplete ? 'Renovar no próximo ciclo' : `Próxima visita: ${used + 1}/${total}`}</span>
      </div>
    </div>
  )
}
