'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function initAuth() {
      const supabase = createClient()
      
      // Check current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        setIsAuthenticated(true)
        return
      }

      // NO SESSION: Auto-login with the seed admin user for development
      // In production, this would redirect to a login page instead.
      const { error } = await supabase.auth.signInWithPassword({
        email: 'admin@barberzac.com.br',
        password: 'admin123'
      })

      if (!error) {
        setIsAuthenticated(true)
      } else {
        console.error("Auto-login failed:", error.message)
      }
    }

    initAuth()
  }, [])

  // If not authenticated yet, we can either render children anyway (and queries fail temporarily before retry)
  // or return null/loading. Returning null prevents flash of empty state errors.
  if (!isAuthenticated) return <div className="flex w-screen h-screen items-center justify-center text-sm font-medium text-[var(--text-secondary)]">Autenticando sessão...</div>

  return <>{children}</>
}
