"use client"

import { useState } from "react"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { navItems } from "./Sidebar"
import { useAppSettings } from "@/features/settings/hooks/useSettings"
import PWAInstallButton from "@/components/PWAInstallButton"

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { organizationName } = useAppSettings()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

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

      {/* Greeting + PWA Install */}
      <div className="flex items-center gap-2">
        <PWAInstallButton />
        <span className="text-xs font-medium text-[var(--text-secondary)]">{greeting}</span>
      </div>
    </header>
  )
}
