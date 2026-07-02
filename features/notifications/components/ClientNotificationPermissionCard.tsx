'use client'

import { Bell, BellOff, BellRing, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useNotificationPermission } from '../hooks/useNotificationPermission'
import { useClientNotifications } from '../hooks/useClientNotifications'
import { InstallPwaGuide } from './InstallPwaGuide'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function ClientNotificationPermissionCard() {
  const permission = useNotificationPermission()
  const { hasActiveSubscription, isLoadingSubscription } = useClientNotifications()

  useEffect(() => {
    if (!isLoadingSubscription) {
      permission.updateSubscriptionStatus(hasActiveSubscription)
    }
  }, [hasActiveSubscription, isLoadingSubscription, permission.updateSubscriptionStatus])

  const handleActivate = async () => {
    const result = await permission.requestPermission()
    if (result.success) {
      toast.success('Notificações ativadas com sucesso!')
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  const handleDeactivate = async () => {
    const result = await permission.deactivate()
    if (result.success) {
      toast.success('Notificações desativadas neste dispositivo.')
    } else if (result.error) {
      toast.error(result.error)
    }
  }

  if (permission.isLoading && permission.pushState === 'loading') {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-muted)]">Verificando notificações...</span>
        </CardContent>
      </Card>
    )
  }

  if (permission.pushState === 'not_supported') {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Navegador não compatível</p>
              <p className="text-xs text-[var(--text-muted)]">
                Seu navegador não oferece suporte completo para notificações neste momento.
                Você ainda pode acompanhar seus horários dentro da Área do Cliente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (permission.pushState === 'ios_needs_install') {
    return <InstallPwaGuide />
  }

  if (permission.pushState === 'permission_denied') {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--danger-bg)] flex items-center justify-center shrink-0">
              <BellOff className="w-5 h-5 text-[var(--danger)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Notificações bloqueadas</p>
              <p className="text-xs text-[var(--text-muted)]">
                As notificações estão bloqueadas neste navegador.
                Para voltar a receber alertas, ajuste a permissão nas configurações do navegador ou do dispositivo.
              </p>
              {permission.platform === 'ios' && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  No iPhone/iPad: Ajustes → BarberZAC → Notificações → Permitir Notificações
                </p>
              )}
              {permission.platform === 'android' && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  No Android: Toque no cadeado na barra de endereço → Notificações → Permitir
                </p>
              )}
              {permission.platform === 'desktop' && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Clique no ícone de cadeado na barra de endereço → Notificações → Permitir
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (permission.pushState === 'active' || hasActiveSubscription) {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                Notificações ativadas neste dispositivo
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Você receberá alertas sobre seus agendamentos.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] px-0"
                onClick={handleDeactivate}
                disabled={permission.isLoading}
              >
                {permission.isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Desativar neste dispositivo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-[var(--info)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Ative as notificações</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Acompanhe seus horários sem depender de mensagens manuais.
              Receba alertas de confirmação, alteração e cancelamento.
            </p>
            <Button
              size="sm"
              className="h-8 text-xs font-semibold"
              onClick={handleActivate}
              disabled={permission.isLoading}
            >
              {permission.isLoading ? (
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              ) : (
                <Bell className="w-3.5 h-3.5 mr-1.5" />
              )}
              ATIVAR NOTIFICAÇÕES
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
