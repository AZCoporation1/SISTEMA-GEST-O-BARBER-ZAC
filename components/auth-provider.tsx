'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
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
  systemRole: SystemRoleEnum | 'customer' | 'unknown'
  collaboratorId: string | null
  canApprove: boolean
  canViewAllProfessionals: boolean
  canManageSystem: boolean
  canSubmitRequests: boolean
  isCustomer: boolean
  isInternalUser: boolean
  canAccessERP: boolean
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
  isInternalUser: boolean
  canAccessERP: boolean
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
  isInternalUser: false,
  canAccessERP: false,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// ── Cache TTL for profile data (60 seconds) ──
const PROFILE_CACHE_TTL_MS = 60_000

interface ProfileCache {
  user: AuthUser | null
  sessionUserId: string | null
  timestamp: number
  /** Which route category was used when cached */
  routeCategory: 'customer' | 'erp' | 'public'
}

function getRouteCategory(pathname: string): 'customer' | 'erp' | 'public' {
  if (pathname === '/cliente' || pathname.startsWith('/cliente/')) return 'customer'
  if (pathname === '/login') return 'public'
  return 'erp'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // ── Cache ref — survives re-renders without causing them ──
  const cacheRef = useRef<ProfileCache>({
    user: null,
    sessionUserId: null,
    timestamp: 0,
    routeCategory: 'public',
  })

  // ── Guard against concurrent fetches ──
  const fetchingRef = useRef(false)

  // ── Stable supabase instance ──
  const supabaseRef = useRef(createClient())

  const fetchProfile = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current && !force) return
    fetchingRef.current = true

    try {
      const supabase = supabaseRef.current
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Clear cache
        cacheRef.current = { user: null, sessionUserId: null, timestamp: 0, routeCategory: 'public' }
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

      // ── Check cache validity ──
      const currentCategory = getRouteCategory(pathname)
      const cache = cacheRef.current
      const cacheAge = Date.now() - cache.timestamp
      const isSameSession = cache.sessionUserId === session.user.id
      const isSameCategory = cache.routeCategory === currentCategory
      const isCacheValid = isSameSession && isSameCategory && cacheAge < PROFILE_CACHE_TTL_MS

      if (!force && isCacheValid && cache.user !== null) {
        // Cache hit — reuse without querying
        if (user?.authUserId !== cache.user.authUserId) {
          setUser(cache.user)
        }
        setIsLoading(false)
        return
      }

      // ── Cache miss — fetch from DB ──

      // Step 1: Check user_profiles (real internal users)
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, auth_user_id, full_name, email, system_role, display_name, collaborator_id, can_approve_professional_requests, can_view_all_professionals, can_manage_system, can_submit_professional_requests')
        .eq('auth_user_id', session.user.id)
        .single()

      const profile = profileData as any

      if (profile) {
        const isOnCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')

        if (!isOnCustomerRoute) {
          // Real internal user on ERP route — has user_profile, set as internal
          const authUser: AuthUser = {
            id: profile.id,
            authUserId: session.user.id,
            email: profile.email,
            fullName: profile.full_name,
            displayName: profile.display_name,
            systemRole: profile.system_role || 'unknown',
            collaboratorId: profile.collaborator_id,
            canApprove: profile.can_approve_professional_requests || false,
            canViewAllProfessionals: profile.can_view_all_professionals || false,
            canManageSystem: profile.can_manage_system || false,
            canSubmitRequests: profile.can_submit_professional_requests || false,
            isCustomer: false,
            isInternalUser: true,
            canAccessERP: true,
          }
          // Update cache
          cacheRef.current = {
            user: authUser,
            sessionUserId: session.user.id,
            timestamp: Date.now(),
            routeCategory: currentCategory,
          }
          setUser(authUser)
          setIsLoading(false)
          return
        }
        // If on customer route WITH user_profile → fall through to customer check below
        // This handles Supabase identity linking and dual_identity cases
      }

      // ── Step 2: Try to find/create customer record ──
      // This is reached when:
      // - No user_profile exists (normal customer)
      // - user_profile exists but user is on /cliente/* route (dual identity / identity linking)

      const isOnCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')

      // Try client-side customer query first (may fail on RLS)
      const { data: customerData } = await supabase
        .from('customers')
        .select('id, full_name, email')
        .eq('auth_user_id', session.user.id)
        .maybeSingle() as { data: any }

      if (customerData) {
        // Found customer — set as customer user
        const authUser: AuthUser = {
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
          isInternalUser: false,
          canAccessERP: false,
          customerId: customerData.id,
        }
        cacheRef.current = {
          user: authUser,
          sessionUserId: session.user.id,
          timestamp: Date.now(),
          routeCategory: currentCategory,
        }
        setUser(authUser)
        setIsLoading(false)
        return
      }

      // No customer found via client query
      if (isOnCustomerRoute) {
        // On customer route — try ensure via server action (uses service_role)
        try {
          const ensureResult = await ensureCustomerForAuthUser(session.user.id, {
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
            phone: session.user.user_metadata?.phone,
          })
          if (ensureResult.success && ensureResult.customerId) {
            const authUser: AuthUser = {
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
              isInternalUser: false,
              canAccessERP: false,
              customerId: ensureResult.customerId,
            }
            cacheRef.current = {
              user: authUser,
              sessionUserId: session.user.id,
              timestamp: Date.now(),
              routeCategory: currentCategory,
            }
            setUser(authUser)
          } else {
            // Ensure failed — still NOT internal. Set as customer with sync error.
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
              isCustomer: false, // sync failed — page will handle
              isInternalUser: false, // CRITICAL: NOT internal
              canAccessERP: false,
            })
          }
        } catch {
          // Ensure errored — still NOT internal
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
            isInternalUser: false, // CRITICAL: NOT internal
            canAccessERP: false,
          })
        }
      } else {
        // Not on customer route, no user_profile — this is an UNKNOWN user
        // NOT a professional. NOT internal. Redirect to /cliente.
        setUser({
          id: '',
          authUserId: session.user.id,
          email: session.user.email || '',
          fullName: session.user.email?.split('@')[0] || 'Usuário',
          displayName: null,
          systemRole: 'unknown', // CRITICAL: NOT 'professional'
          collaboratorId: null,
          canApprove: false,
          canViewAllProfessionals: false,
          canManageSystem: false,
          canSubmitRequests: false,
          isCustomer: false,
          isInternalUser: false,
          canAccessERP: false,
        })
        // Redirect unknown users to customer area
        router.replace('/cliente')
      }

      setIsLoading(false)
    } finally {
      fetchingRef.current = false
    }
  }, [pathname, router, user?.authUserId])

  useEffect(() => {
    fetchProfile()

    // Listen for auth state changes (login/logout)
    const supabase = supabaseRef.current
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        // Clear cache on logout
        cacheRef.current = { user: null, sessionUserId: null, timestamp: 0, routeCategory: 'public' }
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
      } else if (session.user.id !== cacheRef.current.sessionUserId) {
        // Different user logged in — force refresh
        cacheRef.current = { user: null, sessionUserId: null, timestamp: 0, routeCategory: 'public' }
        fetchProfile(true)
      }
      // If same session user — don't refetch, cache handles it
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, pathname, router])

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current
    await supabase.auth.signOut()
    // Clear cache on sign out
    cacheRef.current = { user: null, sessionUserId: null, timestamp: 0, routeCategory: 'public' }
    setUser(null)
    // Redirect to appropriate login based on context
    const isOnCustomerRoute = pathname === '/cliente' || pathname.startsWith('/cliente/')
    router.replace(isOnCustomerRoute ? '/cliente' : '/login')
  }, [router, pathname])

  const isAdmin = user?.systemRole === 'admin_total'
  const isProfessional = user?.systemRole === 'professional'
  const isOwner = user?.systemRole === 'owner_admin_professional'
  const isCustomer = user?.isCustomer || false
  const isInternalUser = user?.isInternalUser || false
  const canAccessERP = user?.canAccessERP || false
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
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isProfessional, isOwner, hasAdminAccess, hasProfessionalAccess, isCustomer, isInternalUser, canAccessERP, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
