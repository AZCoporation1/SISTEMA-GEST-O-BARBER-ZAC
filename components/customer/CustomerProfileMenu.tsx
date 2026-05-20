"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  User, LogOut, Calendar, ChevronDown, UserCircle,
  LogIn, UserPlus, Sparkles, ArrowRight, X, CalendarPlus,
  Sun, Moon,
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

// ── Portal wrapper — renders children in document.body ──────
// Required because the header has `backdrop-blur-xl` which creates
// a new CSS containing block, breaking `position: fixed` for children.
function MenuPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

export default function CustomerProfileMenu() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape — return focus
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when open (mobile)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const handleClose = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const handleLogout = async () => {
    handleClose()
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Você saiu da sua conta.")
    router.replace('/cliente')
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  if (isLoading) {
    return <div className="w-9 h-9 rounded-full bg-secondary/60 animate-pulse" />
  }

  const getInitials = (name?: string | null) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0]?.toUpperCase() || '?'
  }

  const callbackParam = encodeURIComponent(pathname)

  // ═══════════════════════════════════════════════════════════
  // NOT LOGGED IN
  // ═══════════════════════════════════════════════════════════
  if (!user) {
    return (
      <>
        {/* Trigger button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Abrir menu do cliente"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 hover:bg-secondary/80 hover:border-border text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <UserCircle className="w-4.5 h-4.5" />
          <span className="text-xs font-medium">Entrar</span>
        </button>

        {open && (
          <MenuPortal>
            {/* Backdrop — full viewport */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[79] animate-in fade-in duration-200"
              onClick={handleClose}
              aria-hidden="true"
            />

            {/* Bottom Sheet (mobile) / Dropdown (desktop) */}
            <div
              ref={menuRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de conta"
              className="
                fixed z-[80]
                inset-x-0 bottom-0
                md:inset-x-auto md:bottom-auto md:top-[60px] md:right-4
                md:w-[320px]
                animate-in slide-in-from-bottom-6 md:slide-in-from-bottom-0 md:fade-in md:zoom-in-95 duration-300 md:duration-200
              "
            >
              <div
                className="
                  bg-card border border-border/60 shadow-2xl shadow-black/40
                  rounded-t-[20px] md:rounded-2xl
                  max-h-[85dvh] md:max-h-[calc(100vh-80px)]
                  overflow-y-auto overscroll-contain
                "
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
              >
                {/* Handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
                </div>

                {/* Close button (mobile) */}
                <div className="flex justify-end px-4 pt-1 md:hidden">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors active:scale-95"
                    aria-label="Fechar menu"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Welcome */}
                <div className="px-5 pt-2 pb-5 md:pt-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-secondary to-secondary/60 border border-border/50 flex items-center justify-center shadow-inner shrink-0">
                      <Sparkles className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-foreground tracking-tight">Área do Cliente</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                        Entre ou crie sua conta para acompanhar seus agendamentos.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Entrar */}
                    <Link
                      href={`/cliente/login?callbackUrl=${callbackParam}`}
                      className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all duration-150 shadow-md min-h-[52px]"
                      onClick={handleClose}
                    >
                      <span className="flex items-center gap-3">
                        <LogIn className="w-5 h-5" />
                        Entrar na conta
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </Link>

                    {/* Criar conta */}
                    <Link
                      href={`/cliente/login?callbackUrl=${callbackParam}`}
                      className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-medium border border-border/70 text-foreground/80 hover:bg-secondary/60 hover:text-foreground hover:border-border active:scale-[0.97] transition-all duration-150 min-h-[52px]"
                      onClick={handleClose}
                    >
                      <span className="flex items-center gap-3">
                        <UserPlus className="w-5 h-5" />
                        Criar conta grátis
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-30" />
                    </Link>

                    {/* Agendar */}
                    <Link
                      href="/cliente/agendar"
                      className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground active:scale-[0.97] transition-all duration-150 min-h-[52px]"
                      onClick={handleClose}
                    >
                      <span className="flex items-center gap-3">
                        <CalendarPlus className="w-5 h-5" />
                        Agendar agora
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-20" />
                    </Link>
                  </div>
                </div>

                {/* Close action (mobile) */}
                <div className="px-5 pb-4 md:hidden">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-full py-3.5 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground border border-border/40 hover:bg-secondary/40 transition-all min-h-[48px] active:scale-[0.97]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </MenuPortal>
        )}
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // LOGGED IN
  // ═══════════════════════════════════════════════════════════
  const initials = getInitials(user.fullName)

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Abrir menu de perfil"
        className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-ring/50 transition-all duration-200"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted-foreground/40 to-secondary border border-border/60 flex items-center justify-center text-xs font-bold text-foreground shadow-md">
          {initials}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden md:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <MenuPortal>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[79] animate-in fade-in duration-200"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Bottom Sheet (mobile) / Dropdown (desktop) */}
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de perfil"
            className="
              fixed z-[80]
              inset-x-0 bottom-0
              md:inset-x-auto md:bottom-auto md:top-[60px] md:right-4
              md:w-[320px]
              animate-in slide-in-from-bottom-6 md:slide-in-from-bottom-0 md:fade-in md:zoom-in-95 duration-300 md:duration-200
            "
          >
            <div
              className="
                bg-card border border-border/60 shadow-2xl shadow-black/40
                rounded-t-[20px] md:rounded-2xl
                max-h-[85dvh] md:max-h-[calc(100vh-80px)]
                overflow-y-auto overscroll-contain
              "
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
            >
              {/* Handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
              </div>

              {/* Close button (mobile) */}
              <div className="flex justify-end px-4 pt-1 md:hidden">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors active:scale-95"
                  aria-label="Fechar menu"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Profile summary */}
              <div className="px-5 pt-2 pb-4 border-b border-border/50 md:pt-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-muted-foreground/40 to-secondary border border-border/60 flex items-center justify-center text-sm font-bold text-foreground shadow-lg shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-foreground truncate tracking-tight">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="py-2 px-2">
                <NavItem href="/cliente/perfil" icon={User} label="Meu Perfil" onClose={handleClose} />
                <NavItem href="/cliente/meus-agendamentos" icon={Calendar} label="Meus Agendamentos" onClose={handleClose} />
                <NavItem href="/cliente/agendar" icon={CalendarPlus} label="Agendar novo horário" onClose={handleClose} />

                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-[0.97] min-h-[48px] group"
                >
                  <div className="w-9 h-9 rounded-xl bg-secondary/80 group-hover:bg-secondary flex items-center justify-center transition-colors shrink-0">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  <span className="flex-1 text-left">{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
              </div>

              {/* Logout */}
              <div className="py-2 px-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-red-400/90 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150 active:scale-[0.97] min-h-[48px] group"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-500/8 group-hover:bg-red-500/15 flex items-center justify-center transition-colors shrink-0">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-left">Sair da conta</span>
                </button>
              </div>

              {/* Close (mobile) */}
              <div className="px-5 pb-4 md:hidden">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3.5 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground border border-border/40 hover:bg-secondary/40 transition-all min-h-[48px] active:scale-[0.97]"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </MenuPortal>
      )}
    </>
  )
}

// ── Nav Item — reusable menu link ────────────────────────────
function NavItem({
  href,
  icon: Icon,
  label,
  onClose,
}: {
  href: string
  icon: React.ElementType
  label: string
  onClose: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-[0.97] min-h-[48px] group"
    >
      <div className="w-9 h-9 rounded-xl bg-secondary/80 group-hover:bg-secondary flex items-center justify-center transition-colors shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <span className="flex-1">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
    </Link>
  )
}
