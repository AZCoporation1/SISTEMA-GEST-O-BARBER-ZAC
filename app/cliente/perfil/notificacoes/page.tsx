'use client'

import { useAuth } from '@/components/auth-provider'
import { useClientNotificationPreferences } from '@/features/notifications/hooks/useClientNotificationPreferences'
import { useNotificationPermission } from '@/features/notifications/hooks/useNotificationPermission'
import { useClientNotifications } from '@/features/notifications/hooks/useClientNotifications'
import { ClientNotificationPermissionCard } from '@/features/notifications/components/ClientNotificationPermissionCard'
import { ClientPwaInstallCard } from '@/features/notifications/components/ClientPwaInstallCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BellRing, Shield, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { NotificationPreferencesInput } from '@/features/notifications/types'

interface PreferenceToggle {
  key: keyof NotificationPreferencesInput
  label: string
  description: string
}

const PREFERENCE_TOGGLES: PreferenceToggle[] = [
  {
    key: 'notify_new_appointment',
    label: 'Confirmações de agendamento',
    description: 'Receba avisos quando seu horário for agendado',
  },
  {
    key: 'notify_rescheduled_appointment',
    label: 'Alterações de horário',
    description: 'Saiba quando seu agendamento for alterado',
  },
  {
    key: 'notify_cancelled_appointment',
    label: 'Cancelamentos',
    description: 'Receba avisos de cancelamento',
  },
  {
    key: 'notify_checkin',
    label: 'Check-in confirmado',
    description: 'Saiba quando seu check-in for registrado',
  },
]

export default function ClientNotificationPreferencesPage() {
  const { user, isCustomer, isLoading: isAuthLoading } = useAuth()
  const router = useRouter()
  const { preferences, isLoading: isLoadingPrefs, isUpdating, updatePreferences } = useClientNotificationPreferences()
  const permission = useNotificationPermission()
  const { hasActiveSubscription } = useClientNotifications()

  if (isAuthLoading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    )
  }

  if (!user || !isCustomer) return null

  const handleToggle = (key: keyof NotificationPreferencesInput, value: boolean) => {
    updatePreferences({ [key]: value } as NotificationPreferencesInput, {
      onSuccess: () => toast.success('Preferência atualizada'),
      onError: () => toast.error('Erro ao salvar preferência'),
    })
  }

  return (
    <div className="space-y-4 py-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Notificações e aplicativo</h1>
      </div>

      {/* Push Status */}
      <ClientNotificationPermissionCard />

      {/* PWA Install */}
      <ClientPwaInstallCard />

      {/* Preferences */}
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            Preferências de avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {isLoadingPrefs ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            PREFERENCE_TOGGLES.map(toggle => {
              const currentValue = preferences?.[toggle.key as keyof typeof preferences] ?? true
              return (
                <div key={toggle.key} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{toggle.label}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{toggle.description}</p>
                  </div>
                  <Switch
                    checked={currentValue as boolean}
                    onCheckedChange={(val) => handleToggle(toggle.key, val)}
                    disabled={isUpdating}
                    aria-label={toggle.label}
                  />
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Status do dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Permissão do navegador</span>
              <span className="font-medium text-[var(--text-primary)]">
                {permission.permissionStatus === 'granted' ? '✅ Concedida' :
                 permission.permissionStatus === 'denied' ? '❌ Bloqueada' : '⏳ Pendente'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Inscrição push</span>
              <span className="font-medium text-[var(--text-primary)]">
                {hasActiveSubscription ? '✅ Ativa' : '❌ Inativa'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Aplicativo instalado</span>
              <span className="font-medium text-[var(--text-primary)]">
                {permission.isStandalone ? '✅ Instalado' : '❌ Não instalado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Plataforma</span>
              <span className="font-medium text-[var(--text-primary)] capitalize">
                {permission.platform}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
            <p className="text-xs text-[var(--text-muted)]">
              Suas notificações são privadas. Nunca enviamos dados pessoais como telefone,
              e-mail ou valores na tela bloqueada. Você pode desativar as notificações
              a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
