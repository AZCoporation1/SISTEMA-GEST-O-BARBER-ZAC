'use client'

import { useAuth } from '@/components/auth-provider'
import { useClientNotifications } from '@/features/notifications/hooks/useClientNotifications'
import { ClientNotificationItem } from '@/features/notifications/components/ClientNotificationItem'
import { ClientNotificationEmptyState } from '@/features/notifications/components/ClientNotificationEmptyState'
import { ClientNotificationPermissionCard } from '@/features/notifications/components/ClientNotificationPermissionCard'
import { ClientPwaInstallCard } from '@/features/notifications/components/ClientPwaInstallCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ClientNotificacoesPage() {
  const { user, isCustomer, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const {
    notifications,
    isLoadingNotifications,
    unreadCount,
  } = useClientNotifications(30)

  if (isAuthLoading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!user || !isCustomer) {
    return null
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.back()}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Notificações</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-[var(--danger)] text-white text-[10px] font-bold px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <Link href="/cliente/perfil/notificacoes">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Preferências de notificação">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Push activation card */}
      <ClientNotificationPermissionCard />

      {/* PWA install card */}
      <ClientPwaInstallCard />

      {/* Notification list */}
      <div className="space-y-0.5">
        {isLoadingNotifications ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <ClientNotificationEmptyState />
        ) : (
          notifications.map((n) => (
            <ClientNotificationItem
              key={n.id}
              title={n.title}
              body={n.body}
              eventType={n.eventType}
              createdAt={n.createdAt}
              isRead={n.isRead}
            />
          ))
        )}
      </div>
    </div>
  )
}
