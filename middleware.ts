import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

// Customer routes are handled via prefix matching
const isCustomerRoute = (pathname: string) => pathname === '/cliente' || pathname.startsWith('/cliente/')
const isProtectedCustomerRoute = (pathname: string) => pathname.startsWith('/cliente/meus-agendamentos') || pathname.startsWith('/cliente/agendar/confirmacao')
const isPublicCustomerRoute = (pathname: string) => isCustomerRoute(pathname) && !isProtectedCustomerRoute(pathname)

// Routes exclusively for admin/owner users
const ADMIN_ROUTES = [
  '/dashboard',
  '/estoque',
  '/movimentacoes',
  '/vendas',
  '/perfumes',
  '/clientes',
  '/servicos',
  '/comissoes',
  '/caixa',
  '/fluxo-de-caixa',
  '/custos',
  '/relatorios',
  '/importar-exportar',
  '/configuracoes',
  '/auditoria',
  '/agendamento',
  '/aprovacao-profissionais',
]

// Routes exclusively for professional users
const PROFESSIONAL_ROUTES = ['/profissional']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Allow internal public routes (e.g. /login)
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (user) {
      // Determine role
      const { data: profile } = await supabase.from('user_profiles').select('system_role').eq('auth_user_id', user.id).single()
      let role = profile?.system_role
      if (!role) {
        const { data: cust } = await supabase.from('customers').select('id').eq('auth_user_id', user.id).single() as { data: any }
        if (cust) role = 'customer'
      }

      if (role === 'customer') {
        return NextResponse.redirect(new URL('/cliente/meus-agendamentos', request.url))
      }
      if (role === 'professional') {
        return NextResponse.redirect(new URL('/profissional', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Handle customer public routes
  if (isPublicCustomerRoute(pathname)) {
    // If user is authenticated as customer and tries to access /cliente/login, redirect to dashboard
    if (user && pathname === '/cliente/login') {
      const { data: profile } = await supabase.from('user_profiles').select('system_role').eq('auth_user_id', user.id).single()
      if (!profile?.system_role) {
        const { data: cust } = await supabase.from('customers').select('id').eq('auth_user_id', user.id).single() as { data: any }
        if (cust) return NextResponse.redirect(new URL('/cliente/meus-agendamentos', request.url))
      }
    }
    // Allow public access
    if (!user) {
      return supabaseResponse
    }
  }

  // Not authenticated and not on a public route → redirect to appropriate login
  if (!user) {
    const url = request.nextUrl.clone()
    if (isCustomerRoute(pathname)) {
      url.pathname = '/cliente/login'
    } else {
      url.pathname = '/login'
    }
    return NextResponse.redirect(url)
  }

  // Fetch user role for route gating
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role')
    .eq('auth_user_id', user.id)
    .single()

  let role = profile?.system_role
  
  if (!role) {
    const { data: cust } = await supabase.from('customers').select('id').eq('auth_user_id', user.id).single() as { data: any }
    if (cust) {
      role = 'customer'
    } else {
      role = 'professional' // fallback
    }
  }

  // Root redirect
  if (pathname === '/') {
    if (role === 'professional') {
      return NextResponse.redirect(new URL('/profissional', request.url))
    }
    if (role === 'customer') {
      return NextResponse.redirect(new URL('/cliente/meus-agendamentos', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Customer trying to access internal routes -> redirect to customer portal
  if (role === 'customer') {
    if (!pathname.startsWith('/cliente')) {
      return NextResponse.redirect(new URL('/cliente', request.url))
    }
    // Let them access anything inside /cliente
    return supabaseResponse
  }

  // Professional or Admin trying to access /cliente → allow access for testing
  // (their role is still respected inside the customer flow)

  // Professional trying to access admin routes → redirect to professional home
  if (role === 'professional') {
    const isAdminRoute = ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
    if (isAdminRoute) {
      return NextResponse.redirect(new URL('/profissional', request.url))
    }
  }

  // Admin (non-owner) trying to access professional routes → redirect to dashboard
  if (role === 'admin_total') {
    const isProfessionalRoute = PROFESSIONAL_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
    if (isProfessionalRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Owner can access everything — no redirect needed
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, icons, etc)
     * - API routes
     * - manifest
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$|api).*)',
  ],
}
