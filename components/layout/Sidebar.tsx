'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppSettings } from '@/features/settings/hooks/useSettings'
import { useAuth } from '@/components/auth-provider'
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
  ListPlus,
  Sparkles,
  ClipboardCheck,
  LogOut,
  User
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NavItem = {
  section: string
  items: {
    href: string
    icon: React.ElementType
    label: string
    badge?: string
    badgeCount?: number
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
    section: 'Aprovação',
    items: [
      { href: '/aprovacao-profissionais', icon: ClipboardCheck, label: 'Aprovações' },
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
      { href: '/perfumes', icon: Sparkles, label: 'Perfumes' },
      { href: '/clientes', icon: Users, label: 'Clientes' },
      { href: '/servicos', icon: ListPlus, label: 'Serviços' },
      { href: '/comissoes', icon: Scissors, label: 'Profissionais' },
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
  const { user, signOut, isOwner, hasAdminAccess } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  // Fetch pending approval count for badge
  useEffect(() => {
    if (!hasAdminAccess) return
    const supabase = createClient()
    supabase
      .from('professional_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0))
  }, [hasAdminAccess, pathname])

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  // Build nav items with pending count badge
  const enrichedNavItems = navItems.map(section => ({
    ...section,
    items: section.items.map(item => {
      if (item.href === '/aprovacao-profissionais' && pendingCount > 0) {
        return { ...item, badgeCount: pendingCount }
      }
      return item
    })
  }))

  const roleLabel = user?.systemRole === 'owner_admin_professional' ? 'Owner' : user?.systemRole === 'admin_total' ? 'Admin' : 'Profissional'
  const roleBadgeClass = user?.systemRole === 'owner_admin_professional' ? 'owner' : user?.systemRole === 'admin_total' ? 'admin' : 'professional'

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
        {enrichedNavItems.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ href, icon: Icon, label, badge, badgeCount }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-item ${isActive(href) ? 'active' : ''}`}
              >
                <Icon size={17} strokeWidth={1.7} />
                <span>{label}</span>
                {badge && <span className="sidebar-badge">{badge}</span>}
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'var(--warning)',
                    color: '#000',
                    borderRadius: 100,
                    padding: '1px 7px',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}>
                    {badgeCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}

        {/* Owner: link to professional area */}
        {isOwner && (
          <div>
            <div className="sidebar-section-label">Minha Área</div>
            <Link
              href="/profissional"
              className={`sidebar-item ${pathname.startsWith('/profissional') ? 'active' : ''}`}
            >
              <User size={17} strokeWidth={1.7} />
              <span>Área Profissional</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User + PWA + Footer */}
      <div className="px-3 py-3 border-t border-[var(--border)] flex flex-col gap-2">
        {/* User info */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
              {user.displayName?.[0] || user.fullName?.[0] || '?'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName || user.fullName}
              </div>
              <span className={`user-badge ${roleBadgeClass}`}>{roleLabel}</span>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="sidebar-item"
          style={{ width: '100%', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, justifyContent: 'center' }}
        >
          <LogOut size={14} />
          <span>Sair</span>
        </button>
        <PWAInstallButton />
        <span className="text-[10px] text-[var(--text-muted)] tracking-wide font-medium px-2">
          v1.0.0 · Instituto {organizationName}
        </span>
      </div>
    </aside>
  )
}
