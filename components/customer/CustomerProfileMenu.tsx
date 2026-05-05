"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { User, LogOut, Calendar, Award, ChevronDown, X, UserCircle } from 'lucide-react'
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
      <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
    )
  }

  // Get initials
  const getInitials = (name?: string | null) => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0]?.toUpperCase() || '?'
  }

  // Not logged in
  if (!user) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 p-1.5 rounded-full hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Menu de conta"
        >
          <UserCircle className="w-6 h-6" />
        </button>

        {open && (
          <>
            {/* Mobile backdrop */}
            <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setOpen(false)} />
            
            {/* Mobile: bottom sheet / Desktop: dropdown */}
            <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:right-0 md:bottom-auto md:top-full md:mt-2 md:inset-x-auto md:w-64">
              <div className="bg-zinc-900 border border-zinc-800 md:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden">
                {/* Handle bar (mobile) */}
                <div className="flex justify-center py-2 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-zinc-700" />
                </div>

                <div className="p-4 space-y-2">
                  <p className="text-sm text-zinc-400 px-2 pb-2">Entre para agendar e acompanhar</p>
                  
                  <Link
                    href={`/cliente/login?callbackUrl=${encodeURIComponent(pathname)}`}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-zinc-200 bg-zinc-100/10 hover:bg-zinc-100/20 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Entrar
                  </Link>

                  <Link
                    href={`/cliente/login?callbackUrl=${encodeURIComponent(pathname)}`}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <UserCircle className="w-4 h-4" />
                    Criar conta
                  </Link>
                </div>

                {/* Mobile close */}
                <div className="px-4 pb-4 md:hidden">
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-3 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
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

  // Logged in
  const initials = getInitials(user.fullName)

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-zinc-800/60 transition-colors"
        aria-label="Menu de perfil"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shadow-inner">
          {initials}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform hidden md:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setOpen(false)} />
          
          {/* Mobile: bottom sheet / Desktop: dropdown */}
          <div className="fixed inset-x-0 bottom-0 z-50 md:absolute md:right-0 md:bottom-auto md:top-full md:mt-2 md:inset-x-auto md:w-72">
            <div className="bg-zinc-900 border border-zinc-800 md:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden">
              {/* Handle bar (mobile) */}
              <div className="flex justify-center py-2 md:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>

              {/* Profile summary */}
              <div className="px-4 pt-2 pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shadow-inner">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200 truncate">{user.fullName}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-2 space-y-0.5">
                <Link
                  href="/cliente/perfil"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <User className="w-4 h-4 text-zinc-500" />
                  Meu Perfil
                </Link>

                <Link
                  href="/cliente/meus-agendamentos"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  Meus Agendamentos
                </Link>

                <Link
                  href="/cliente/perfil"
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <Award className="w-4 h-4 text-zinc-500" />
                  Pontos e Fidelidade
                </Link>
              </div>

              {/* Logout */}
              <div className="p-2 border-t border-zinc-800">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da conta
                </button>
              </div>

              {/* Mobile close */}
              <div className="px-4 pb-4 md:hidden">
                <button
                  onClick={() => setOpen(false)}
                  className="w-full py-3 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
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
