// ── Notification Settings Card (Admin) ──────────────────────
// Barber Zac ERP — Push notification activation card for settings page
"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bell, BellOff, BellRing, Check, AlertTriangle,
  Smartphone, Monitor, Trash2, TestTube, Loader2, Wifi, WifiOff,
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
  unregisterPushSubscription,
} from '../actions/notification.actions'
import { InstallPwaGuide } from './InstallPwaGuide'
import type { PermissionStatus } from '../types'

type ActivationState =
  | 'loading'
  | 'not_supported'
  | 'ios_needs_install'
  | 'permission_default'
  | 'permission_granted'
  | 'permission_denied'
  | 'provider_not_configured'

interface DeviceInfo {
  id: string
  platform: string
  browser: string
  device_label: string
  is_pwa: boolean
  is_active: boolean
  permission_status: string
  last_seen_at: string | null
  created_at: string
}

export function NotificationSettingsCard() {
  const [state, setState] = useState<ActivationState>('loading')
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [isActivating, setIsActivating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const refreshState = useCallback(async () => {
    // Detect support
    const support = detectPushSupport()
    if (!support.supported) {
      setState('not_supported')
      return
    }

    // Check iOS
    const iosStatus = getIOSPushStatus()
    if (iosStatus.needsInstall) {
      setState('ios_needs_install')
      return
    }

    // Check provider
    if (!isProviderConfigured()) {
      setState('provider_not_configured')
    }

    // Check permission
    const permission = getPermissionStatus()
    if (permission === 'denied') {
      setState('permission_denied')
    } else if (permission === 'granted') {
      setState('permission_granted')
    } else {
      setState('permission_default')
    }

    // Load devices
    const result = await getMyPushSubscriptions()
    if (result.success && result.data) {
      setDevices(result.data)
    }
  }, [])

  useEffect(() => {
    refreshState()
  }, [refreshState])

  const handleActivate = async () => {
    setIsActivating(true)
    setMessage(null)

    const result = await requestAndRegisterPush()

    if (result.success) {
      setMessage({ type: 'success', text: 'Notificações ativadas com sucesso!' })
      setState('permission_granted')
      await refreshState()
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao ativar.' })
      if (result.permissionStatus === 'denied') setState('permission_denied')
    }

    setIsActivating(false)
  }

  const handleTest = async () => {
    setIsTesting(true)
    setMessage(null)

    const result = await sendTestNotification()

    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Teste enviado!' })
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao enviar teste.' })
    }

    setIsTesting(false)
  }

  const handleDeactivate = async () => {
    setIsDeactivating(true)
    setMessage(null)

    const result = await unregisterCurrentDevice()

    if (result.success) {
      setMessage({ type: 'success', text: 'Notificações desativadas neste dispositivo.' })
      await refreshState()
    } else {
      setMessage({ type: 'error', text: result.error || 'Erro ao desativar.' })
    }

    setIsDeactivating(false)
  }

  const handleRemoveDevice = async (id: string) => {
    await unregisterPushSubscription(id)
    await refreshState()
  }

  const activeDevices = devices.filter(d => d.is_active)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-4 w-4" />
          Notificações do Sistema
        </CardTitle>
        <CardDescription>
          Receba alertas de agendamentos, cancelamentos, assinaturas e movimentações importantes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading */}
        {state === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando suporte...
          </div>
        )}

        {/* Not supported */}
        {state === 'not_supported' && (
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <BellOff className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Não suportado</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Seu navegador não suporta notificações push. Tente Chrome, Edge ou Safari.
              </p>
            </div>
          </div>
        )}

        {/* iOS needs PWA install */}
        {state === 'ios_needs_install' && (
          <InstallPwaGuide />
        )}

        {/* Provider not configured */}
        {state === 'provider_not_configured' && (
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <WifiOff className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--warning, #f59e0b)' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Provider não configurado</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                O Firebase Cloud Messaging não está configurado. Configure as variáveis de ambiente para ativar envio real.
              </p>
            </div>
          </div>
        )}

        {/* Permission not requested yet */}
        {state === 'permission_default' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Bell className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Notificações disponíveis</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Clique abaixo para ativar notificações push neste dispositivo.
                </p>
              </div>
            </div>
            <Button onClick={handleActivate} disabled={isActivating} className="w-full sm:w-auto">
              {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              {isActivating ? 'Ativando...' : 'Ativar notificações'}
            </Button>
          </div>
        )}

        {/* Permission granted */}
        {state === 'permission_granted' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--accent-subtle, hsl(142 76% 36% / 0.1))', border: '1px solid var(--accent, hsl(142 76% 36%))' }}>
              <Check className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Notificações ativas</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeDevices.length} dispositivo(s) registrado(s).
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {activeDevices.length === 0 && (
                <Button onClick={handleActivate} disabled={isActivating} size="sm">
                  {isActivating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                  Registrar este dispositivo
                </Button>
              )}
              <Button onClick={handleTest} disabled={isTesting} variant="outline" size="sm">
                {isTesting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube className="h-3 w-3 mr-1" />}
                Testar notificação
              </Button>
              {activeDevices.length > 0 && (
                <Button onClick={handleDeactivate} disabled={isDeactivating} variant="outline" size="sm">
                  {isDeactivating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                  Desativar neste dispositivo
                </Button>
              )}
            </div>

            {/* Device list */}
            {devices.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dispositivos registrados
                </p>
                {devices.map(device => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-2 rounded-lg text-xs"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', opacity: device.is_active ? 1 : 0.5 }}
                  >
                    <div className="flex items-center gap-2">
                      {device.platform === 'desktop' ? (
                        <Monitor className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <Smartphone className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      )}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {device.device_label || `${device.browser} / ${device.platform}`}
                      </span>
                      {device.is_pwa && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                          PWA
                        </span>
                      )}
                      {!device.is_active && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'var(--danger-subtle, hsl(0 84% 60% / 0.1))', color: 'var(--danger, hsl(0 84% 60%))' }}>
                          Inativo
                        </span>
                      )}
                    </div>
                    {device.is_active && (
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        title="Remover dispositivo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Permission denied */}
        {state === 'permission_denied' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--danger-subtle, hsl(0 84% 60% / 0.1))', border: '1px solid var(--danger, hsl(0 84% 60%))' }}>
              <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--danger, hsl(0 84% 60%))' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Permissão negada</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Você bloqueou notificações. Para habilitar, vá nas configurações do seu navegador e permita notificações para este site.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback message */}
        {message && (
          <div
            className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium"
            style={{
              background: message.type === 'success' ? 'var(--accent-subtle, hsl(142 76% 36% / 0.1))' : 'var(--danger-subtle, hsl(0 84% 60% / 0.1))',
              color: message.type === 'success' ? 'var(--accent)' : 'var(--danger, hsl(0 84% 60%))',
            }}
          >
            {message.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {message.text}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
