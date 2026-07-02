'use client'

import { Download, Smartphone, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useInstallPrompt } from '@/pwa/useInstallPrompt'
import { isInstalledAsPWA, detectPlatform } from '../lib/pushClient'
import { useState, useEffect, useCallback } from 'react'

const DISMISS_KEY = 'barberzac-pwa-install-dismissed'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function ClientPwaInstallCard() {
  const { supported: canPromptInstall, installed: justInstalled, promptInstall } = useInstallPrompt()
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(true)
  const [platform, setPlatform] = useState<string>('desktop')
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsInstalled(isInstalledAsPWA() || justInstalled)
    setPlatform(detectPlatform())
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10)
      setIsDismissed(elapsed < DISMISS_COOLDOWN_MS)
    } else {
      setIsDismissed(false)
    }
  }, [justInstalled])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setIsDismissed(true)
  }, [])

  const handleInstall = useCallback(async () => {
    await promptInstall()
  }, [promptInstall])

  if (isInstalled || isDismissed) return null

  if (platform === 'ios') {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)] relative">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-[var(--text-muted)]" onClick={handleDismiss} aria-label="Dispensar">
          <X className="w-3.5 h-3.5" />
        </Button>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Tenha o BarberZAC sempre à mão</p>
              <p className="text-xs text-[var(--text-muted)] mb-3">Instale o aplicativo para acessar sua agenda com mais rapidez e receber avisos importantes.</p>
              {showGuide ? (
                <div className="space-y-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-lg p-3">
                  <p className="font-medium text-[var(--text-primary)]">Como instalar:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Toque em <span className="font-medium">Compartilhar</span> <ExternalLink className="w-3 h-3 inline" /></li>
                    <li>Escolha <span className="font-medium">&quot;Adicionar à Tela de Início&quot;</span></li>
                    <li>Abra o BarberZAC pelo ícone criado</li>
                    <li>Toque em <span className="font-medium">&quot;Ativar notificações&quot;</span></li>
                  </ol>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowGuide(true)}>
                  VER COMO INSTALAR
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (canPromptInstall) {
    return (
      <Card className="border-[var(--border)] bg-[var(--bg-surface)] relative">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-[var(--text-muted)]" onClick={handleDismiss} aria-label="Dispensar">
          <X className="w-3.5 h-3.5" />
        </Button>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 pr-4">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Tenha o BarberZAC sempre à mão</p>
              <p className="text-xs text-[var(--text-muted)] mb-3">Instale o aplicativo para acessar sua agenda com mais rapidez e receber avisos importantes.</p>
              <Button size="sm" className="h-8 text-xs font-semibold" onClick={handleInstall}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                INSTALAR APLICATIVO
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
