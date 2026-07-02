'use client'

import { Calendar, XCircle, RefreshCw, Bell, CheckCircle2, AlertTriangle, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClientNotificationItemProps {
  title: string
  body: string
  eventType: string
  createdAt: string
  isRead: boolean
  onClick?: () => void
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  appointment_created: Calendar,
  appointment_cancelled: XCircle,
  appointment_rescheduled: RefreshCw,
  appointment_checkin: CheckCircle2,
  appointment_completed: CheckCircle2,
  appointment_no_show: AlertTriangle,
  test_notification: Bell,
  subscription_closed: CheckCircle2,
  subscription_cancelled: XCircle,
  marketing: Megaphone,
}

const EVENT_COLORS: Record<string, string> = {
  appointment_created: 'text-[var(--info)] bg-[var(--info-bg)]',
  appointment_cancelled: 'text-[var(--danger)] bg-[var(--danger-bg)]',
  appointment_rescheduled: 'text-[var(--warning)] bg-[var(--warning-bg)]',
  appointment_checkin: 'text-[var(--success)] bg-[var(--success-bg)]',
  appointment_completed: 'text-[var(--success)] bg-[var(--success-bg)]',
  appointment_no_show: 'text-[var(--warning)] bg-[var(--warning-bg)]',
  test_notification: 'text-[var(--info)] bg-[var(--info-bg)]',
  subscription_closed: 'text-[var(--success)] bg-[var(--success-bg)]',
  subscription_cancelled: 'text-[var(--danger)] bg-[var(--danger-bg)]',
}

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Agora'
  if (diffMinutes < 60) return `${diffMinutes}min`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function ClientNotificationItem({
  title,
  body,
  eventType,
  createdAt,
  isRead,
  onClick,
}: ClientNotificationItemProps) {
  const Icon = EVENT_ICONS[eventType] || Bell
  const colorClass = EVENT_COLORS[eventType] || 'text-[var(--text-muted)] bg-[var(--accent-subtle)]'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors rounded-lg',
        'hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        !isRead && 'bg-[var(--accent-subtle)]'
      )}
      type="button"
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', colorClass)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-sm truncate',
            !isRead ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'
          )}>
            {title}
          </p>
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0">
            {formatRelativeTime(createdAt)}
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{body}</p>
      </div>
      {!isRead && (
        <div className="w-2 h-2 rounded-full bg-[var(--info)] shrink-0 mt-2" aria-hidden="true" />
      )}
    </button>
  )
}
