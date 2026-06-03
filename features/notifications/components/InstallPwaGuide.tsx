// ── Install PWA Guide (Notifications) ───────────────────────
// Barber Zac ERP — iOS-specific guide for installing PWA to enable push
"use client"

import { Share, PlusSquare, Smartphone } from 'lucide-react'

export function InstallPwaGuide() {
  return (
    <div className="space-y-3">
      <div
        className="p-4 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Instale o Barber Zac no iPhone
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Notificações push no iOS exigem que o app esteja instalado na Tela de Início.
            </p>
          </div>
        </div>

        <div className="space-y-3 pl-1">
          {/* Step 1 */}
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              1
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Toque em <Share className="inline h-3.5 w-3.5 mx-0.5" style={{ color: 'var(--accent)' }} /> <strong>Compartilhar</strong>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Na barra inferior do Safari
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              2
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Toque em <PlusSquare className="inline h-3.5 w-3.5 mx-0.5" style={{ color: 'var(--accent)' }} /> <strong>Adicionar à Tela de Início</strong>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Desça na lista de opções até encontrar
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              3
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Abra pelo <strong>ícone instalado</strong>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                O app abre em tela cheia, como um app nativo
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              4
            </div>
            <div className="pt-0.5">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Volte aqui e <strong>ative as notificações</strong>
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                O botão de ativação aparecerá automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
        Requer iOS 16.4 ou superior. iPadOS 16.4+ também é compatível.
      </p>
    </div>
  )
}
