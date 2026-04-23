'use client'

import { useAuth } from '@/components/auth-provider'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard, PlusCircle, ClipboardList, Wallet, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

const proNavItems = [
  { href: '/profissional', label: 'Meu Painel', icon: LayoutDashboard },
  { href: '/profissional/registrar', label: 'Registrar', icon: PlusCircle },
  { href: '/profissional/solicitacoes', label: 'Solicitações', icon: ClipboardList },
  { href: '/profissional/conta', label: 'Minha Conta', icon: Wallet },
]

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, hasAdminAccess } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const roleLabel = user?.systemRole === 'owner_admin_professional' ? 'Owner' : 'Profissional'
  const roleBadgeClass = user?.systemRole === 'owner_admin_professional' ? 'owner' : 'professional'

  return (
    <div className="pro-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="pro-sidebar">
        <div className="sidebar-logo">
          <Image
            src="/logo-b.png"
            alt="Barber Zac"
            width={38}
            height={38}
            className="sidebar-logo-mark"
            style={{ borderRadius: 10, objectFit: 'contain' }}
          />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">Barber Zac</span>
            <span className="sidebar-logo-sub">Profissional</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Menu</span>
          {proNavItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}

          {/* Owner: link to admin area */}
          {hasAdminAccess && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 16 }}>Admin</span>
              <Link href="/dashboard" className="sidebar-item">
                <LayoutDashboard size={18} />
                <span>Ir para Admin</span>
              </Link>
            </>
          )}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '0 4px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
              {user?.displayName?.[0] || user?.fullName?.[0] || '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || user?.fullName}
              </div>
              <span className={`user-badge ${roleBadgeClass}`}>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="sidebar-item"
            style={{ width: '100%', color: 'var(--danger)' }}
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="pro-main">
        {/* Mobile Header */}
        <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'none' }}
              className="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Image src="/logo-b.png" alt="BZ" width={28} height={28} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {user?.displayName || user?.fullName}
            </span>
            <span className={`user-badge ${roleBadgeClass}`}>{roleLabel}</span>
          </div>
          <button
            onClick={signOut}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
          >
            Sair
          </button>
        </header>

        {/* Mobile Nav (visible < 768px) */}
        {mobileMenuOpen && (
          <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {proNavItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            ))}
            {hasAdminAccess && (
              <Link href="/dashboard" className="sidebar-item" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard size={18} />
                <span>Ir para Admin</span>
              </Link>
            )}
          </div>
        )}

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>

        {/* Mobile Bottom Nav (fixed) */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
          display: 'none', padding: '8px 0',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          zIndex: 50,
        }} className="mobile-bottom-nav">
          {proNavItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                fontSize: 9, fontWeight: 600, textDecoration: 'none',
                color: pathname === item.href ? 'var(--accent)' : 'var(--text-secondary)',
                letterSpacing: '0.04em',
              }}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile-specific CSS */}
      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-menu-toggle { display: block !important; }
          .mobile-bottom-nav { display: flex !important; }
          .pro-main .page-content { padding-bottom: 80px; }
        }
      `}</style>
    </div>
  )
}
