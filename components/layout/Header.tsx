"use client"

import { useState } from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { navItems } from "./Sidebar"
import { useAuth } from "@/components/auth-provider"
import { useAppSettings } from "@/features/settings/hooks/useSettings"
import PWAInstallButton from "@/components/PWAInstallButton"

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { organizationName } = useAppSettings()
  const { user, signOut, isOwner } = useAuth()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const roleLabel = user?.systemRole === 'owner_admin_professional' ? 'Owner' : user?.systemRole === 'admin_total' ? 'Admin' : 'Profissional'
  const roleBadgeClass = user?.systemRole === 'owner_admin_professional' ? 'owner' : user?.systemRole === 'admin_total' ? 'admin' : 'professional'

  return (
    <header className="topbar md:hidden">
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile Menu Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col border-r border-[var(--border)]" style={{ background: 'var(--bg-surface)' }}>
            <SheetHeader className="p-5 border-b border-[var(--border)] text-left">
              <SheetTitle className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <Image 
                    src="/logo-b.png" 
                    alt={`${organizationName} Logo`}
                    width={48} 
                    height={48} 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--text-primary)] leading-tight">{organizationName}</span>
                  <span className="text-[10px] uppercase font-semibold tracking-[0.12em]" style={{ color: 'var(--accent)' }}>Sistema de Gestão</span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
              {navItems.map(({ section, items }) => (
                <div key={section}>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--text-muted)] mb-2 mt-4 first:mt-0 px-3">
                    {section}
                  </div>
                  <nav className="flex flex-col gap-1">
                    {items.map(({ href, icon: Icon, label, badge }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                          isActive(href)
                            ? "bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold border border-[var(--accent-border)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-transparent"
                        }`}
                      >
                        <Icon size={17} strokeWidth={1.7} />
                        <span>{label}</span>
                        {badge && (
                          <span className="ml-auto text-[9px] font-semibold px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]">
                            {badge}
                          </span>
                        )}
                      </Link>
                    ))}
                  </nav>
                </div>
              ))}

              {/* Owner: link to professional area */}
              {isOwner && (
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--text-muted)] mb-2 mt-4 px-3">
                    Minha Área
                  </div>
                  <Link
                    href="/profissional"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border border-transparent`}
                  >
                    <User size={17} strokeWidth={1.7} />
                    <span>Área Profissional</span>
                  </Link>
                </div>
              )}
            </div>

            {/* User info + Logout */}
            <div className="border-t border-[var(--border)] p-3 flex flex-col gap-2">
              {user && (
                <div className="flex items-center gap-2 px-2 py-1">
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                    {user.displayName?.[0] || user.fullName?.[0] || '?'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{user.displayName || user.fullName}</span>
                    <span className={`user-badge ${roleBadgeClass}`}>{roleLabel}</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setOpen(false); signOut() }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
                style={{ fontFamily: 'inherit', background: 'transparent', cursor: 'pointer', width: '100%' }}
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Brand */}
        <div className="flex items-center gap-2">
          <Image 
            src="/logo-b.png" 
            alt={`${organizationName} Logo`}
            width={24} 
            height={24} 
            className="w-6 h-6 object-contain"
          />
          <span className="text-sm font-bold text-[var(--text-primary)]">{organizationName}</span>
        </div>
      </div>

      {/* User + PWA */}
      <div className="flex items-center gap-2">
        <PWAInstallButton />
        {user && <span className={`user-badge ${roleBadgeClass}`}>{roleLabel}</span>}
      </div>
    </header>
  )
}
