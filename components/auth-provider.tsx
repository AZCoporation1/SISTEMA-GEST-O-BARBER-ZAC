'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { SystemRoleEnum } from '@/types/supabase'

export interface AuthUser {
  id: string
  authUserId: string
  email: string
  fullName: string
  displayName: string | null
  systemRole: SystemRoleEnum
  collaboratorId: string | null
  canApprove: boolean
  canViewAllProfessionals: boolean
  canManageSystem: boolean
  canSubmitRequests: boolean
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAdmin: boolean
  isProfessional: boolean
  isOwner: boolean
  hasAdminAccess: boolean
  hasProfessionalAccess: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAdmin: false,
  isProfessional: false,
  isOwner: false,
  hasAdminAccess: false,
  hasProfessionalAccess: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const fetchProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setUser(null)
      setIsLoading(false)
      // Only redirect if not already on login page
      if (pathname !== '/login') {
        router.replace('/login')
      }
      return
    }

    // Fetch user profile with role info
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id, full_name, email, system_role, display_name, collaborator_id, can_approve_professional_requests, can_view_all_professionals, can_manage_system, can_submit_professional_requests')
      .eq('auth_user_id', session.user.id)
      .single()

    const profile = profileData as any

    if (profile) {
      setUser({
        id: profile.id,
        authUserId: session.user.id,
        email: profile.email,
        fullName: profile.full_name,
        displayName: profile.display_name,
        systemRole: profile.system_role || 'professional',
        collaboratorId: profile.collaborator_id,
        canApprove: profile.can_approve_professional_requests || false,
        canViewAllProfessionals: profile.can_view_all_professionals || false,
        canManageSystem: profile.can_manage_system || false,
        canSubmitRequests: profile.can_submit_professional_requests || false,
      })
    } else {
      // Profile doesn't exist yet (edge case) — still authenticated but no profile
      setUser({
        id: '',
        authUserId: session.user.id,
        email: session.user.email || '',
        fullName: session.user.email?.split('@')[0] || 'Usuário',
        displayName: null,
        systemRole: 'professional',
        collaboratorId: null,
        canApprove: false,
        canViewAllProfessionals: false,
        canManageSystem: false,
        canSubmitRequests: false,
      })
    }

    setIsLoading(false)
  }, [pathname, router])

  useEffect(() => {
    fetchProfile()

    // Listen for auth state changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null)
        if (pathname !== '/login') {
          router.replace('/login')
        }
      } else {
        fetchProfile()
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, pathname, router])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.replace('/login')
  }, [router])

  const isAdmin = user?.systemRole === 'admin_total'
  const isProfessional = user?.systemRole === 'professional'
  const isOwner = user?.systemRole === 'owner_admin_professional'
  const hasAdminAccess = isAdmin || isOwner
  const hasProfessionalAccess = isProfessional || isOwner

  if (isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-[var(--text-secondary)]">Carregando sessão...</span>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isProfessional, isOwner, hasAdminAccess, hasProfessionalAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
