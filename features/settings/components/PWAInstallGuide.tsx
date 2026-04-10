'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/pwa/useInstallPrompt'
import {
  Download,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  MoreVertical,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

/* ───────── Step Component ───────── */
function Step({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: number
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="pwa-step">
      <div className="pwa-step-number">
        <span>{number}</span>
      </div>
      <div className="pwa-step-content">
        <div className="pwa-step-icon-row">
          <Icon size={16} strokeWidth={2} className="pwa-step-icon" />
          <span className="pwa-step-title">{title}</span>
        </div>
        <p className="pwa-step-desc">{description}</p>
      </div>
    </div>
  )
}

/* ───────── Feature Badge ───────── */
function FeatureBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="pwa-feature-badge">
      <Icon size={14} strokeWidth={2} />
      <span>{label}</span>
    </div>
  )
}

/* ═══════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════ */
export function PWAInstallGuide() {
  const { supported, installed, promptInstall } = useInstallPrompt()
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [standalone, setStandalone] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [swStatus, setSwStatus] = useState<'checking' | 'active' | 'none'>('checking')

  useEffect(() => {
    setPlatform(detectPlatform())
    setStandalone(isStandalone())

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        setSwStatus(reg?.active ? 'active' : 'none')
      })
    } else {
      setSwStatus('none')
    }
  }, [])

  const alreadyInstalled = standalone || installed

  return (
    <Card className="pwa-guide-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Instalar Aplicativo
        </CardTitle>
        <CardDescription>
          Instale o Barber Zac como aplicativo no seu dispositivo para acesso rápido e funcionamento offline.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ─── Status Banner ─── */}
        {alreadyInstalled ? (
          <div className="pwa-status-banner pwa-status-installed">
            <CheckCircle2 size={20} strokeWidth={2} />
            <div>
              <p className="pwa-status-title">Aplicativo Instalado ✓</p>
              <p className="pwa-status-sub">O Barber Zac já está instalado neste dispositivo. Você pode acessá-lo pela tela inicial.</p>
            </div>
          </div>
        ) : (
          <div className="pwa-status-banner pwa-status-ready">
            <Sparkles size={20} strokeWidth={2} />
            <div>
              <p className="pwa-status-title">Pronto para instalar</p>
              <p className="pwa-status-sub">Instale o app para acesso instantâneo, notificações e uso offline.</p>
            </div>
          </div>
        )}

        {/* ─── Feature Badges ─── */}
        <div className="pwa-features-row">
          <FeatureBadge icon={Wifi} label="Funciona offline" />
          <FeatureBadge icon={Smartphone} label="Tela cheia" />
          <FeatureBadge icon={RefreshCw} label="Sync automático" />
          <FeatureBadge icon={Globe} label="Acesso rápido" />
        </div>

        {/* ─── Install Button (Chrome/Edge/Android direct) ─── */}
        {supported && !alreadyInstalled && (
          <Button
            onClick={promptInstall}
            size="lg"
            className="pwa-install-cta"
          >
            <Download size={18} strokeWidth={2} />
            Instalar Barber Zac Agora
          </Button>
        )}

        {/* ─── Expandable Step-by-Step ─── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="pwa-expand-toggle"
        >
          <span>
            {alreadyInstalled ? 'Informações do aplicativo' : 'Como instalar passo a passo'}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expanded && (
          <div className="pwa-steps-container">

            {/* ── iOS ── */}
            {(platform === 'ios' || platform === 'unknown') && (
              <div className="pwa-platform-section">
                <div className="pwa-platform-header">
                  <Smartphone size={16} />
                  <span>iPhone / iPad (Safari)</span>
                </div>
                <div className="pwa-steps-list">
                  <Step
                    number={1}
                    icon={Globe}
                    title="Abra no Safari"
                    description="Acesse barber-zac.vercel.app no navegador Safari. Outros navegadores no iOS não suportam instalação de apps."
                  />
                  <Step
                    number={2}
                    icon={Share}
                    title="Toque em Compartilhar"
                    description="Toque no ícone de compartilhamento (quadrado com seta para cima) na barra inferior do Safari."
                  />
                  <Step
                    number={3}
                    icon={PlusSquare}
                    title='Selecione "Adicionar à Tela de Início"'
                    description="Role para baixo no menu e toque em 'Adicionar à Tela de Início'. Confirme tocando em 'Adicionar'."
                  />
                  <Step
                    number={4}
                    icon={CheckCircle2}
                    title="Pronto!"
                    description="O ícone do Barber Zac aparecerá na sua tela inicial. Toque nele para abrir o app em tela cheia."
                  />
                </div>
              </div>
            )}

            {/* ── Android ── */}
            {(platform === 'android' || platform === 'unknown') && (
              <div className="pwa-platform-section">
                <div className="pwa-platform-header">
                  <Smartphone size={16} />
                  <span>Android (Chrome)</span>
                </div>
                <div className="pwa-steps-list">
                  <Step
                    number={1}
                    icon={Globe}
                    title="Abra no Chrome"
                    description="Acesse barber-zac.vercel.app no Google Chrome."
                  />
                  <Step
                    number={2}
                    icon={MoreVertical}
                    title="Toque no menu (⋮)"
                    description="Toque nos três pontos verticais no canto superior direito do Chrome."
                  />
                  <Step
                    number={3}
                    icon={PlusSquare}
                    title='Selecione "Instalar aplicativo"'
                    description='Toque em "Instalar aplicativo" ou "Adicionar à tela inicial". Confirme a instalação.'
                  />
                  <Step
                    number={4}
                    icon={CheckCircle2}
                    title="Pronto!"
                    description="O Barber Zac será instalado como um app nativo. Encontre-o na bandeja de apps."
                  />
                </div>
              </div>
            )}

            {/* ── Desktop ── */}
            {(platform === 'desktop' || platform === 'unknown') && (
              <div className="pwa-platform-section">
                <div className="pwa-platform-header">
                  <Monitor size={16} />
                  <span>Desktop (Chrome / Edge)</span>
                </div>
                <div className="pwa-steps-list">
                  <Step
                    number={1}
                    icon={Globe}
                    title="Abra no Chrome ou Edge"
                    description="Acesse barber-zac.vercel.app no Google Chrome ou Microsoft Edge."
                  />
                  <Step
                    number={2}
                    icon={Download}
                    title="Clique no ícone de instalação"
                    description="Na barra de endereços, clique no ícone de download/instalação (⊕) que aparece à direita. Ou use o botão 'Instalar Barber Zac Agora' acima."
                  />
                  <Step
                    number={3}
                    icon={CheckCircle2}
                    title="Confirme a instalação"
                    description="Clique em 'Instalar' no diálogo que aparecer. O app abrirá em sua própria janela."
                  />
                </div>
              </div>
            )}

            {/* ── SW Status ── */}
            <div className="pwa-sw-status">
              <div className="pwa-sw-row">
                {swStatus === 'active' ? (
                  <WifiOff size={14} className="pwa-sw-icon-active" />
                ) : (
                  <WifiOff size={14} className="pwa-sw-icon-none" />
                )}
                <span>Modo offline:</span>
                <span className={swStatus === 'active' ? 'pwa-sw-active' : 'pwa-sw-none'}>
                  {swStatus === 'checking' ? 'Verificando...' : swStatus === 'active' ? 'Ativo' : 'Indisponível'}
                </span>
              </div>
              <div className="pwa-sw-row">
                <Smartphone size={14} />
                <span>Plataforma detectada:</span>
                <span className="pwa-sw-platform">
                  {platform === 'ios' ? 'iOS (iPhone/iPad)' : platform === 'android' ? 'Android' : platform === 'desktop' ? 'Desktop' : 'Não identificada'}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
