'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { SystemRoleEnum } from '@/types/supabase'
import { ensureCustomerForAuthUser } from '@/features/customers/actions/customer-auth.actions'

export interface AuthUser {
  id: string
  authUserId: string
  email: string
  fullName: string
  displayName: string | null
  systemRole: SystemRoleEnum | 'customer'
  collaboratorId: string | null
  canApprove: boolean
  canViewAllProfessionals: boolean
  canManageSystem: boolean
  canSubmitRequests: boolean
  isCustomer: boolean
  customerId?: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAdmin: boolean
  isProfessional: boolean
  isOwner: boolean
  hasAdminAccess: boolean
  hasProfessionalAccess: boolean
  isCustomer: boolean
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
  isCustomer: false,
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
      
      const isCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')
      const isCustomerPublic = isCustomerRoute && !pathname.startsWith('/cliente/meus-agendamentos') && !pathname.startsWith('/cliente/agendar/confirmacao') && !pathname.startsWith('/cliente/perfil')
      const isPublic = pathname === '/login' || isCustomerPublic
      
      if (!isPublic) {
        if (isCustomerRoute) {
          router.replace('/cliente/login')
        } else {
          router.replace('/login')
        }
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
        isCustomer: false,
      })
    } else {
      // No user_profile — check if customer or try to create one on customer routes
      const isOnCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')

      // Try to find existing customer first (via client query — may fail on RLS)
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, full_name, email')
        .eq('auth_user_id', session.user.id)
        .maybeSingle() as { data: any }

      if (customerData) {
        setUser({
          id: customerData.id,
          authUserId: session.user.id,
          email: customerData.email || session.user.email || '',
          fullName: customerData.full_name || session.user.email?.split('@')[0] || 'Cliente',
          displayName: null,
          systemRole: 'customer',
          collaboratorId: null,
          canApprove: false,
          canViewAllProfessionals: false,
          canManageSystem: false,
          canSubmitRequests: false,
          isCustomer: true,
          customerId: customerData.id,
        })
      } else if (isOnCustomerRoute) {
        // On customer route without customer record — try ensure (server action, uses service_role)
        try {
          const ensureResult = await ensureCustomerForAuthUser(session.user.id, {
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name,
            phone: session.user.user_metadata?.phone,
          })
          if (ensureResult.customerId) {
            setUser({
              id: ensureResult.customerId,
              authUserId: session.user.id,
              email: ensureResult.email || session.user.email || '',
              fullName: ensureResult.fullName || session.user.email?.split('@')[0] || 'Cliente',
              displayName: null,
              systemRole: 'customer',
              collaboratorId: null,
              canApprove: false,
              canViewAllProfessionals: false,
              canManageSystem: false,
              canSubmitRequests: false,
              isCustomer: true,
              customerId: ensureResult.customerId,
            })
          } else {
            // Ensure failed — set as unauthenticated-like state on customer route
            setUser({
              id: '',
              authUserId: session.user.id,
              email: session.user.email || '',
              fullName: session.user.email?.split('@')[0] || 'Usuário',
              displayName: null,
              systemRole: 'customer',
              collaboratorId: null,
              canApprove: false,
              canViewAllProfessionals: false,
              canManageSystem: false,
              canSubmitRequests: false,
              isCustomer: false, // Mark as not customer — page will handle error display
            })
          }
        } catch {
          // Ensure errored — still set user so page can handle
          setUser({
            id: '',
            authUserId: session.user.id,
            email: session.user.email || '',
            fullName: session.user.email?.split('@')[0] || 'Usuário',
            displayName: null,
            systemRole: 'customer',
            collaboratorId: null,
            canApprove: false,
            canViewAllProfessionals: false,
            canManageSystem: false,
            canSubmitRequests: false,
            isCustomer: false,
          })
        }
      } else {
        // Not on customer route, no profile — treat as professional fallback
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
          isCustomer: false,
        })
      }
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
        
        const isCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')
        const isCustomerPublic = isCustomerRoute && !pathname.startsWith('/cliente/meus-agendamentos') && !pathname.startsWith('/cliente/agendar/confirmacao') && !pathname.startsWith('/cliente/perfil')
        const isPublic = pathname === '/login' || isCustomerPublic
        
        if (!isPublic) {
          if (isCustomerRoute) {
            router.replace('/cliente/login')
          } else {
            router.replace('/login')
          }
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
    // Redirect to appropriate login based on context
    const isOnCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')
    router.replace(isOnCustomerRoute ? '/cliente' : '/login')
  }, [router, pathname])

  const isAdmin = user?.systemRole === 'admin_total'
  const isProfessional = user?.systemRole === 'professional'
  const isOwner = user?.systemRole === 'owner_admin_professional'
  const isCustomer = user?.isCustomer || false
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
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isProfessional, isOwner, hasAdminAccess, hasProfessionalAccess, isCustomer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
