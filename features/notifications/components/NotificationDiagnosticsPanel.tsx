// ── Notification Diagnostics Panel (Admin) ──────────────────
// Barber Zac ERP — Admin panel for push notification monitoring
"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Activity, Smartphone, Monitor, Check, X, Clock,
  AlertTriangle, Loader2, Send, RefreshCw, SkipForward,
} from 'lucide-react'
import { getNotificationDiagnostics, sendTestNotificationToUser } from '../actions/notification.actions'

interface DiagnosticsData {
  subscriptions: any[]
  recentLogs: any[]
  stats: {
    activeDevices: number
    totalSent: number
    totalFailed: number
  }
  fcmEnabled: boolean
}

export function NotificationDiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sendingTestTo, setSendingTestTo] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; msg: string } | null>(null)

  const load = async () => {
    setIsLoading(true)
    const result = await getNotificationDiagnostics()
    if (result.success && result.data) {
      setData(result.data as any)
    }
    setIsLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSendTest = async (userProfileId: string) => {
    setSendingTestTo(userProfileId)
    const result = await sendTestNotificationToUser(userProfileId)
    setTestResult({
      id: userProfileId,
      msg: result.success ? (result.message || 'Enviado!') : (result.error || 'Falhou'),
    })
    setSendingTestTo(null)
    setTimeout(() => setTestResult(null), 4000)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check size={12} style={{ color: 'var(--accent)' }} />
      case 'failed': return <X size={12} style={{ color: 'var(--danger, #ef4444)' }} />
      case 'skipped': return <SkipForward size={12} style={{ color: 'var(--warning, #f59e0b)' }} />
      default: return <Clock size={12} style={{ color: 'var(--text-muted)' }} />
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      sent: { bg: 'hsl(142 76% 36% / 0.1)', color: 'var(--accent)' },
      failed: { bg: 'hsl(0 84% 60% / 0.1)', color: 'var(--danger, #ef4444)' },
      skipped: { bg: 'hsl(45 93% 47% / 0.1)', color: 'var(--warning, #f59e0b)' },
      pending: { bg: 'var(--bg-surface)', color: 'var(--text-muted)' },
    }
    const c = colors[status] || colors.pending
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
        style={{ background: c.bg, color: c.color }}
      >
        {statusIcon(status)}
        {status}
      </span>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando diagnósticos...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Diagnóstico de Notificações
            </CardTitle>
            <CardDescription>
              Monitoramento de dispositivos e entregas push.
            </CardDescription>
          </div>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Dispositivos ativos</p>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{data.stats.activeDevices}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Total enviados</p>
            <p className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{data.stats.totalSent}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Falhas</p>
            <p className="text-lg font-bold" style={{ color: 'var(--danger, #ef4444)' }}>{data.stats.totalFailed}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>FCM</p>
            <p className="text-lg font-bold" style={{ color: data.fcmEnabled ? 'var(--accent)' : 'var(--warning, #f59e0b)' }}>
              {data.fcmEnabled ? 'Ativo' : 'Off'}
            </p>
          </div>
        </div>

        {/* Subscriptions Table */}
        {data.subscriptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Dispositivos registrados ({data.subscriptions.length})
            </p>
            <div className="space-y-1.5" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {data.subscriptions.map((sub: any) => {
                const userName = sub.user_profiles?.display_name || sub.user_profiles?.full_name || '—'
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-2 rounded-lg text-xs"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      opacity: sub.is_active ? 1 : 0.5,
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {sub.platform === 'desktop' ? (
                        <Monitor className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <Smartphone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                          {userName}
                        </span>
                        <span className="block truncate" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          {sub.role} · {sub.platform} · {sub.browser || '—'}
                          {sub.is_pwa && ' · PWA'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!sub.is_active && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold" style={{ background: 'hsl(0 84% 60% / 0.1)', color: 'var(--danger, #ef4444)' }}>
                          Inativo
                        </span>
                      )}
                      {sub.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5"
                          onClick={() => handleSendTest(sub.user_profile_id)}
                          disabled={sendingTestTo === sub.user_profile_id}
                        >
                          {sendingTestTo === sub.user_profile_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      {testResult?.id === sub.user_profile_id && (
                        <span className="text-[10px]" style={{ color: 'var(--accent)' }}>{testResult?.msg}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Logs */}
        {data.recentLogs.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Últimos envios ({data.recentLogs.length})
            </p>
            <div className="space-y-1" style={{ maxHeight: 250, overflowY: 'auto' }}>
              {data.recentLogs.map((log: any) => {
                const userName = log.user_profiles?.display_name || log.user_profiles?.full_name || '—'
                const eventTitle = log.notification_events?.title || log.notification_events?.event_type || '—'
                const deviceInfo = log.push_subscriptions
                  ? `${log.push_subscriptions.platform || '?'} / ${log.push_subscriptions.browser || '?'}`
                  : '—'
                const time = log.created_at ? new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2 rounded text-[11px]"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {statusBadge(log.status)}
                        <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                          {eventTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        <span>{userName}</span>
                        <span>·</span>
                        <span>{deviceInfo}</span>
                        {log.error_message && (
                          <>
                            <span>·</span>
                            <span className="truncate" style={{ color: 'var(--danger, #ef4444)' }}>{log.error_message}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 ml-2" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      {time}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {data.subscriptions.length === 0 && data.recentLogs.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
            Nenhum dispositivo registrado ou envio realizado ainda.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
