// ── Professional Notification Card ──────────────────────────
// Barber Zac ERP — Push notification card for /profissional/conta
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bell, BellOff, BellRing, Check, AlertTriangle,
  TestTube, Loader2, Smartphone, Settings2,
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
  getMyNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
} from '../actions/notification.actions'
import { InstallPwaGuide } from './InstallPwaGuide'
import { Switch } from '@/components/ui/switch'

type CardState = 'loading' | 'not_supported' | 'ios_needs_install' | 'ready' | 'active' | 'denied'

interface PrefToggle {
  key: string
  label: string
}

const PREF_TOGGLES: PrefToggle[] = [
  { key: 'notify_new_appointment', label: 'Novo agendamento' },
  { key: 'notify_cancelled_appointment', label: 'Cancelamento' },
  { key: 'notify_rescheduled_appointment', label: 'Reagendamento' },
  { key: 'notify_checkin', label: 'Check-in' },
  { key: 'notify_no_show', label: 'Ausência' },
  { key: 'notify_completed', label: 'Atendimento finalizado' },
]

export function ProfessionalNotificationCard() {
  const [cardState, setCardState] = useState<CardState>('loading')
  const [deviceCount, setDeviceCount] = useState(0)
  const [isActivating, setIsActivating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)
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

    // Load preferences
    const prefsResult = await getMyNotificationPreferences()
    if (prefsResult.success && prefsResult.data) {
      setPrefs(prefsResult.data as any)
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
      setMessage({ type: 'success', text: 'Notificações desativadas neste dispositivo.' })
      await refresh()
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro.' })
    }
    setIsDeactivating(false)
  }

  const handleTogglePref = async (key: string, value: boolean) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setIsSavingPrefs(true)
    await updateNotificationPreferences(updated as any)
    setIsSavingPrefs(false)
  }

  if (cardState === 'loading') return null

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', marginTop: 16, overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div className="flex items-center gap-2 mb-1">
          <BellRing size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Notificações da Agenda
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Receba avisos quando um cliente agendar, cancelar ou alterar horário com você.
        </p>
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        {/* Not supported */}
        {cardState === 'not_supported' && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>
            Seu navegador não suporta notificações push.
          </p>
        )}

        {/* iOS needs install */}
        {cardState === 'ios_needs_install' && <InstallPwaGuide />}

        {/* Permission denied */}
        {cardState === 'denied' && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--danger-subtle, hsl(0 84% 60% / 0.1))' }}>
            <AlertTriangle size={14} style={{ color: 'var(--danger, hsl(0 84% 60%))' }} />
            <span style={{ fontSize: 11, color: 'var(--danger, hsl(0 84% 60%))' }}>
              Permissão negada. Habilite nas configurações do navegador.
            </span>
          </div>
        )}

        {/* Ready to activate */}
        {cardState === 'ready' && (
          <Button onClick={handleActivate} disabled={isActivating} size="sm" className="w-full">
            {isActivating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
            {isActivating ? 'Ativando...' : 'Ativar notificações'}
          </Button>
        )}

        {/* Active */}
        {cardState === 'active' && (
          <div className="space-y-3">
            {/* Status */}
            <div className="flex items-center gap-2">
              <Check size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                Ativo em {deviceCount} dispositivo(s)
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleTest} disabled={isTesting} variant="outline" size="sm">
                {isTesting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube className="h-3 w-3 mr-1" />}
                Testar
              </Button>
              <Button onClick={handleDeactivate} disabled={isDeactivating} variant="outline" size="sm">
                {isDeactivating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                Desativar
              </Button>
              <Button onClick={() => setShowPrefs(!showPrefs)} variant="outline" size="sm">
                <Settings2 className="h-3 w-3 mr-1" />
                Preferências
              </Button>
            </div>

            {/* Inline preferences */}
            {showPrefs && (
              <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {PREF_TOGGLES.map((t) => (
                  <div key={t.key} className="flex items-center justify-between">
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t.label}</span>
                    <Switch
                      checked={!!(prefs as any)[t.key]}
                      onCheckedChange={(v) => handleTogglePref(t.key, v)}
                    />
                  </div>
                ))}
                {isSavingPrefs && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Salvando...</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Feedback message */}
        {message && (
          <div
            className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium mt-3"
            style={{
              background: message.type === 'success' ? 'var(--accent-subtle, hsl(142 76% 36% / 0.1))' : 'var(--danger-subtle, hsl(0 84% 60% / 0.1))',
              color: message.type === 'success' ? 'var(--accent)' : 'var(--danger, hsl(0 84% 60%))',
            }}
          >
            {message.type === 'success' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  )
}
