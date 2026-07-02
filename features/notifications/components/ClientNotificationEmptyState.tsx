'use client'

import { Bell } from 'lucide-react'

interface ClientNotificationEmptyStateProps {
  title?: string
  description?: string
}

export function ClientNotificationEmptyState({
  title = 'Nenhuma novidade por enquanto',
  description = 'Quando houver atualizações sobre seus horários, elas aparecerão aqui.',
}: ClientNotificationEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center mb-4">
        <Bell className="w-7 h-7 text-[var(--text-muted)]" />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</p>
      <p className="text-xs text-[var(--text-muted)] max-w-[240px]">{description}</p>
    </div>
  )
}
