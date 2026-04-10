'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppSettings } from '@/features/settings/hooks/useSettings'
import PWAInstallButton from '@/components/PWAInstallButton'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Calendar,
  Scissors,
  ShieldCheck,
  FileUp,
} from 'lucide-react'

export type NavItem = {
  section: string
  items: {
    href: string
    icon: React.ElementType
    label: string
    badge?: string
  }[]
}

export const navItems: NavItem[] = [
  {
    section: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    section: 'Estoque',
    items: [
      { href: '/estoque', icon: Package, label: 'Estoque' },
      { href: '/movimentacoes', icon: ArrowLeftRight, label: 'Movimentações' },
    ]
  },
  {
    section: 'Comercial',
    items: [
      { href: '/vendas', icon: ShoppingCart, label: 'Vendas' },
      { href: '/comissoes', icon: Users, label: 'Comissões' },
    ]
  },
  {
    section: 'Financeiro',
    items: [
      { href: '/caixa', icon: Wallet, label: 'Caixa' },
      { href: '/fluxo-de-caixa', icon: TrendingUp, label: 'Fluxo de Caixa' },
      { href: '/custos', icon: Receipt, label: 'Custos' },
    ]
  },
  {
    section: 'Análise',
    items: [
      { href: '/relatorios', icon: BarChart3, label: 'Relatórios' },
      { href: '/importar-exportar', icon: FileUp, label: 'Importar / Exportar' },
    ]
  },
  {
    section: 'Sistema',
    items: [
      { href: '/configuracoes', icon: Settings, label: 'Configurações' },
      { href: '/auditoria', icon: ShieldCheck, label: 'Auditoria' },
      { href: '/agendamento', icon: Calendar, label: 'Agendamento', badge: 'Em breve' },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { organizationName } = useAppSettings()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-logo">
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
          <Image 
            src="/logo-b.png" 
            alt={`${organizationName} Logo`}
            width={48} 
            height={48} 
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">{organizationName}</span>
          <span className="sidebar-logo-sub">Sistema de Gestão</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ href, icon: Icon, label, badge }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-item ${isActive(href) ? 'active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
                {badge && <span className="sidebar-badge">{badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* PWA Install + Footer */}
      <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col gap-2">
        <PWAInstallButton />
        <span className="text-[10px] text-[var(--text-muted)] tracking-wide font-medium px-2">
          v1.0.0 · Instituto {organizationName}
        </span>
      </div>
    </aside>
  )
}
