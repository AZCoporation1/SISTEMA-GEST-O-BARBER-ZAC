// ── Notification Preference Panel ────────────────────────────
// Barber Zac ERP — User preference toggles for notification types
"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Settings2, Loader2, Check } from 'lucide-react'
import {
  getMyNotificationPreferences,
  updateNotificationPreferences,
} from '../actions/notification.actions'
import type { NotificationPreferencesInput } from '../types'

interface PreferenceConfig {
  key: keyof NotificationPreferencesInput
  label: string
  description: string
}

const ADMIN_PREFERENCES: PreferenceConfig[] = [
  { key: 'notify_new_appointment', label: 'Novo agendamento', description: 'Quando um cliente agenda' },
  { key: 'notify_cancelled_appointment', label: 'Cancelamento', description: 'Quando um agendamento é cancelado' },
  { key: 'notify_rescheduled_appointment', label: 'Reagendamento', description: 'Quando um agendamento é reagendado' },
  { key: 'notify_checkin', label: 'Check-in', description: 'Quando o cliente chega' },
  { key: 'notify_completed', label: 'Atendimento finalizado', description: 'Quando o serviço é concluído' },
  { key: 'notify_no_show', label: 'Ausência', description: 'Quando o cliente não comparece' },
  { key: 'notify_subscription_closed', label: 'Assinatura fechada', description: 'Quando uma nova assinatura é ativada' },
  { key: 'notify_subscription_cancelled', label: 'Assinatura cancelada', description: 'Quando uma assinatura é cancelada' },
]

const PROFESSIONAL_PREFERENCES: PreferenceConfig[] = [
  { key: 'notify_new_appointment', label: 'Novo agendamento', description: 'Quando um cliente agendar com você' },
  { key: 'notify_cancelled_appointment', label: 'Cancelamento', description: 'Quando um agendamento seu for cancelado' },
  { key: 'notify_rescheduled_appointment', label: 'Reagendamento', description: 'Quando um agendamento seu mudar de horário' },
  { key: 'notify_checkin', label: 'Check-in', description: 'Quando seu cliente chegar' },
  { key: 'notify_no_show', label: 'Ausência', description: 'Quando seu cliente não comparecer' },
  { key: 'notify_completed', label: 'Atendimento finalizado', description: 'Quando o serviço for concluído' },
]

interface NotificationPreferencePanelProps {
  /** If true, shows full admin preferences. If false, shows professional subset. */
  isAdmin?: boolean
}

export function NotificationPreferencePanel({ isAdmin = true }: NotificationPreferencePanelProps) {
  const [prefs, setPrefs] = useState<NotificationPreferencesInput>({
    notify_new_appointment: true,
    notify_cancelled_appointment: true,
    notify_rescheduled_appointment: true,
    notify_checkin: true,
    notify_completed: false,
    notify_no_show: true,
    notify_subscription_closed: true,
    notify_subscription_cancelled: true,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const result = await getMyNotificationPreferences()
      if (result.success && result.data) {
        setPrefs(result.data as any)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  const handleToggle = (key: keyof NotificationPreferencesInput, value: boolean) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await updateNotificationPreferences(prefs)
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const preferenceList = isAdmin ? ADMIN_PREFERENCES : PROFESSIONAL_PREFERENCES

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando preferências...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Preferências de Notificação
        </CardTitle>
        <CardDescription>
          Escolha quais eventos devem gerar notificações push.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event toggles */}
        {preferenceList.map((pref) => (
          <div key={pref.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pref.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pref.description}</p>
            </div>
            <Switch
              checked={!!(prefs as any)[pref.key]}
              onCheckedChange={(checked) => handleToggle(pref.key, checked)}
            />
          </div>
        ))}

        {/* Quiet hours (admin only) */}
        {isAdmin && (
          <>
            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Horário silencioso</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Não enviar notificações durante este período.</p>
                </div>
                <Switch
                  checked={!!prefs.quiet_hours_enabled}
                  onCheckedChange={(checked) => handleToggle('quiet_hours_enabled', checked)}
                />
              </div>
            </div>
            {prefs.quiet_hours_enabled && (
              <div className="flex gap-4 pl-1">
                <div className="space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_start || '22:00'}
                    onChange={(e) => setPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                    className="w-32"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={prefs.quiet_hours_end || '07:00'}
                    onChange={(e) => setPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : saved ? (
              <Check className="h-3 w-3 mr-1" />
            ) : null}
            {isSaving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar preferências'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
