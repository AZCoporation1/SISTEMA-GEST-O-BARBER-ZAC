// ── Client Notification Card ────────────────────────────────
// Barber Zac ERP — Push notification activation for customer area
// Premium mobile-first design consistent with /cliente layout
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bell, BellOff, BellRing, Check, AlertTriangle,
  TestTube, Loader2, Smartphone,
} from 'lucide-react'
import {
  detectPushSupport,
  getPermissionStatus,
  getIOSPushStatus,
  requestAndRegisterPush,
  unregisterCurrentDevice,
  isProviderConfigured,
} from '../lib/pushClient'
import {
  getMyPushSubscriptions,
  sendTestNotification,
} from '../actions/notification.actions'
import { InstallPwaGuide } from './InstallPwaGuide'

type CardState = 'loading' | 'not_supported' | 'ios_needs_install' | 'ready' | 'active' | 'denied'

export function ClientNotificationCard() {
  const [cardState, setCardState] = useState<CardState>('loading')
  const [deviceCount, setDeviceCount] = useState(0)
  const [isActivating, setIsActivating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const refresh = useCallback(async () => {
    const support = detectPushSupport()
    if (!support.supported) { setCardState('not_supported'); return }

    const ios = getIOSPushStatus()
    if (ios.needsInstall) { setCardState('ios_needs_install'); return }

    const perm = getPermissionStatus()
    if (perm === 'denied') { setCardState('denied'); return }

    const result = await getMyPushSubscriptions()
    const activeCount = (result.data || []).filter((d: any) => d.is_active).length
    setDeviceCount(activeCount)

    if (perm === 'granted' && activeCount > 0) {
      setCardState('active')
    } else {
      setCardState('ready')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleActivate = async () => {
    setIsActivating(true)
    setMessage(null)
    const result = await requestAndRegisterPush()
    if (result.success) {
      setMessage({ type: 'success', text: 'Notificações ativadas!' })
      await refresh()
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao ativar.' })
      if (result.permissionStatus === 'denied') setCardState('denied')
    }
    setIsActivating(false)
  }

  const handleTest = async () => {
    setIsTesting(true)
    setMessage(null)
    const result = await sendTestNotification()
    setMessage({
      type: result.success ? 'success' : 'error',
      text: result.success ? (result.message || 'Teste enviado!') : (result.error || 'Erro.'),
    })
    setIsTesting(false)
  }

  const handleDeactivate = async () => {
    setIsDeactivating(true)
    setMessage(null)
    const result = await unregisterCurrentDevice()
    if (result.success) {
      setMessage({ type: 'success', text: 'Notificações desativadas.' })
      await refresh()
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro.' })
    }
    setIsDeactivating(false)
  }

  if (cardState === 'loading') return null

  return (
    <div
      className="p-5 rounded-2xl border border-border bg-card/50 shadow-sm fade-up-fast"
      style={{ animationDelay: '250ms' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <BellRing className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Receba avisos sobre agendamentos e mais.
          </p>
        </div>
      </div>

      {/* Not supported */}
      {cardState === 'not_supported' && (
        <p className="text-xs text-muted-foreground py-2">
          Seu navegador não suporta notificações push. Tente Chrome, Edge ou Safari.
        </p>
      )}

      {/* iOS needs install */}
      {cardState === 'ios_needs_install' && <InstallPwaGuide />}

      {/* Permission denied */}
      {cardState === 'denied' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">
            Permissão negada. Habilite nas configurações do navegador.
          </p>
        </div>
      )}

      {/* Ready to activate */}
      {cardState === 'ready' && (
        <button
          onClick={handleActivate}
          disabled={isActivating}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold premium-cta disabled:opacity-50 transition-colors"
        >
          {isActivating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          {isActivating ? 'Ativando...' : 'Ativar notificações'}
        </button>
      )}

      {/* Active */}
      {cardState === 'active' && (
        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-500">
              Ativo em {deviceCount} dispositivo(s)
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors border border-border btn-press disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
              Testar
            </button>
            <button
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors border border-border btn-press disabled:opacity-50"
            >
              {isDeactivating ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellOff className="w-3 h-3" />}
              Desativar
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {message && (
        <div
          className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium mt-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}
    </div>
  )
}
