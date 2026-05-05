"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { User, LogOut, Calendar, Award, ChevronDown, UserCircle, LogIn, UserPlus, Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function CustomerProfileMenu() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Você saiu da sua conta.")
    router.replace('/cliente')
  }

  if (isLoading) {
    return (
      <div className="w-9 h-9 rounded-full bg-zinc-800/60 animate-pulse" />
    )
  }

  // Get initials
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
      <div ref={menuRef} className="relative">
        {/* Trigger button — more visible for non-logged users */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800/80 hover:border-zinc-600 text-zinc-300 hover:text-white transition-all duration-200"
          aria-label="Menu de conta"
        >
          <UserCircle className="w-4.5 h-4.5" />
          <span className="text-xs font-medium">Entrar</span>
        </button>

        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200"
              onClick={() => setOpen(false)}
            />

            {/* Bottom sheet (mobile) / Dropdown (desktop) */}
            <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:right-0 md:bottom-auto md:top-full md:mt-2.5 md:inset-x-auto md:w-72 animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-300">
              <div className="bg-zinc-900 border border-zinc-800/80 md:rounded-2xl rounded-t-3xl shadow-2xl shadow-black/50 overflow-hidden">
                {/* Handle bar (mobile) */}
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-zinc-700" />
                </div>

                {/* Welcome section */}
                <div className="px-5 pt-4 pb-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-700/80 to-zinc-800 border border-zinc-700/50 flex items-center justify-center shadow-inner">
                      <Sparkles className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">Bem-vindo ao Barber Zac</p>
                      <p className="text-xs text-zinc-500">Entre para agendar e acompanhar</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Primary: Entrar */}
                    <Link
                      href={`/cliente/login?callbackUrl=${callbackParam}`}
                      className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.98] transition-all duration-150 shadow-sm"
                      onClick={() => setOpen(false)}
                    >
                      <span className="flex items-center gap-2.5">
                        <LogIn className="w-4 h-4" />
                        Entrar na conta
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-40" />
                    </Link>

                    {/* Secondary: Criar conta */}
                    <Link
                      href={`/cliente/login?callbackUrl=${callbackParam}`}
                      className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium border border-zinc-700/60 text-zinc-300 hover:bg-zinc-800/80 hover:text-white hover:border-zinc-600 active:scale-[0.98] transition-all duration-150"
                      onClick={() => setOpen(false)}
                    >
                      <span className="flex items-center gap-2.5">
                        <UserPlus className="w-4 h-4" />
                        Criar conta grátis
                      </span>
                      <ArrowRight className="w-4 h-4 opacity-30" />
                    </Link>
                  </div>
                </div>

                {/* Mobile close area */}
                <div className="px-5 pb-5 pt-1 md:hidden">
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-2.5 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // LOGGED IN
  // ═══════════════════════════════════════════════════════════
  const initials = getInitials(user.fullName)
  const firstName = user.fullName?.split(' ')[0] || 'Usuário'

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-zinc-700/50 transition-all duration-200"
        aria-label="Menu de perfil"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 border border-zinc-600/60 flex items-center justify-center text-xs font-bold text-zinc-200 shadow-md">
          {initials}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 hidden md:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Bottom sheet (mobile) / Dropdown (desktop) */}
          <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:right-0 md:bottom-auto md:top-full md:mt-2.5 md:inset-x-auto md:w-72 animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-300">
            <div className="bg-zinc-900 border border-zinc-800/80 md:rounded-2xl rounded-t-3xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Handle bar (mobile) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>

              {/* Profile summary */}
              <div className="px-5 pt-3 pb-4 border-b border-zinc-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 border border-zinc-600/60 flex items-center justify-center text-sm font-bold text-zinc-200 shadow-md shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{user.fullName}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-2 space-y-0.5">
                <Link
                  href="/cliente/perfil"
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800/70 hover:text-white transition-colors group"
                  onClick={() => setOpen(false)}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/80 group-hover:bg-zinc-700/80 flex items-center justify-center transition-colors">
                    <User className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                  </div>
                  <span>Meu Perfil</span>
                </Link>

                <Link
                  href="/cliente/meus-agendamentos"
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800/70 hover:text-white transition-colors group"
                  onClick={() => setOpen(false)}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/80 group-hover:bg-zinc-700/80 flex items-center justify-center transition-colors">
                    <Calendar className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                  </div>
                  <span>Meus Agendamentos</span>
                </Link>

                <Link
                  href="/cliente/perfil"
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-zinc-300 hover:bg-zinc-800/70 hover:text-white transition-colors group"
                  onClick={() => setOpen(false)}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/80 group-hover:bg-zinc-700/80 flex items-center justify-center transition-colors">
                    <Award className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
                  </div>
                  <span>Pontos e Fidelidade</span>
                </Link>
              </div>

              {/* Logout */}
              <div className="p-2 border-t border-zinc-800/60">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm text-red-400/80 hover:bg-red-900/15 hover:text-red-300 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-900/10 group-hover:bg-red-900/20 flex items-center justify-center transition-colors">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>Sair da conta</span>
                </button>
              </div>

              {/* Mobile close */}
              <div className="px-5 pb-5 pt-1 md:hidden">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-2.5 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
