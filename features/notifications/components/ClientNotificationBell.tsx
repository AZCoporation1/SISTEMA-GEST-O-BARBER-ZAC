'use client'

import { Bell } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { useClientNotifications } from '../hooks/useClientNotifications'
import { ClientNotificationItem } from './ClientNotificationItem'
import { ClientNotificationEmptyState } from './ClientNotificationEmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export function ClientNotificationBell() {
  const { user, isCustomer } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const {
    notifications,
    unreadCount,
    isLoadingNotifications,
    invalidateAll,
  } = useClientNotifications(5)

  // Setup foreground message listener
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return

    let cancelled = false

    async function setupListener() {
      try {
        const { getFirebaseApp } = await import('../lib/firebaseClient')
        const app = getFirebaseApp()
        if (!app) return

        const { isSupported, getMessaging, onMessage } = await import('firebase/messaging')
        const supported = await isSupported()
        if (!supported || cancelled) return

        const messaging = getMessaging(app)
        const unsubscribe = onMessage(messaging, () => {
          invalidateAll()
        })

        if (!cancelled) {
          unsubscribeRef.current = unsubscribe
        } else {
          unsubscribe()
        }
      } catch {
        // Silently fail
      }
    }

    setupListener()

    return () => {
      cancelled = true
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [user?.id, invalidateAll])

  if (!user || !isCustomer) return null

  const displayCount = unreadCount > 9 ? '9+' : unreadCount

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : 'Notificações'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[var(--danger)] text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none"
              aria-hidden="true"
            >
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 border-[var(--border)] bg-[var(--bg-surface)] shadow-xl"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notificações</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {isLoadingNotifications ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
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
            <div className="py-1">
              {notifications.map((n) => (
                <ClientNotificationItem
                  key={n.id}
                  title={n.title}
                  body={n.body}
                  eventType={n.eventType}
                  createdAt={n.createdAt}
                  isRead={n.isRead}
                  onClick={() => setIsOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] p-2">
          <Link
            href="/cliente/notificacoes"
            className="block w-full text-center text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-light)] py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Ver todas as notificações
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
