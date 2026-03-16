'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  FileUp,
  Settings,
  Calendar,
  Scissors,
} from 'lucide-react'

const navItems = [
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
      { href: '/agendamento', icon: Calendar, label: 'Agendamento', badge: 'Em breve' },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <Scissors size={16} />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-logo-name">Barber Zac</span>
          <span className="sidebar-logo-sub">Gestão</span>
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
                <Icon size={16} strokeWidth={1.75} />
                <span>{label}</span>
                {badge && <span className="sidebar-badge">{badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Version footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: '10px',
        color: 'var(--text-muted)',
        letterSpacing: '0.04em',
      }}>
        v1.0.0 · Instituto Barber Zac
      </div>
    </aside>
  )
}
