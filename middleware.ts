import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

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

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    // If authenticated, redirect to appropriate home
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('system_role')
        .eq('auth_user_id', user.id)
        .single()

      const role = profile?.system_role || 'professional'

      if (role === 'professional') {
        return NextResponse.redirect(new URL('/profissional', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Fetch user role for route gating
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role')
    .eq('auth_user_id', user.id)
    .single()

  const role = profile?.system_role || 'professional'

  // Root redirect
  if (pathname === '/') {
    if (role === 'professional') {
      return NextResponse.redirect(new URL('/profissional', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

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
