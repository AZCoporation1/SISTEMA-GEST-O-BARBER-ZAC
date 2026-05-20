"use client"

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react'
import { customerLogin, customerSignUp } from '@/features/customers/actions/customer-auth.actions'
import { toast } from 'sonner'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function ClienteLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl') || '/cliente/meus-agendamentos'
  // Validate: only accept internal /cliente paths
  const callbackUrl = rawCallback.startsWith('/cliente') ? rawCallback : '/cliente/meus-agendamentos'
  
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // Phone mask
  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    let formatted = digits
    if (digits.length > 0) formatted = `(${digits.slice(0, 2)}`
    if (digits.length > 2) formatted += `) ${digits.slice(2, 7)}`
    if (digits.length > 7) formatted += `-${digits.slice(7, 11)}`
    setPhone(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const rawPhone = phone.replace(/\D/g, '')

      if (isLogin) {
        const res = await customerLogin({ email: normalizedEmail, password })
        if (!res.success) {
          toast.error(res.error)
        } else {
          toast.success("Login efetuado com sucesso!")
          router.push(callbackUrl)
        }
      } else {
        // Sign up
        const res = await customerSignUp({ fullName: fullName.trim(), email: normalizedEmail, password, phone: rawPhone })
        if (!res.success) {
          toast.error(res.error)
        } else {
          // Account created via admin API — now auto-login
          toast.success("Conta criada! Fazendo login...")
          const loginRes = await customerLogin({ email: normalizedEmail, password })
          if (!loginRes.success) {
            toast.info("Conta criada. Faça login para continuar.")
            setIsLogin(true)
          } else {
            toast.success("Bem-vindo(a)!")
            router.push(callbackUrl)
          }
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/cliente/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })

      if (error) {
        console.error(`OAuth ${provider} error:`, error)
        if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
          toast.info(`Login com ${provider === 'google' ? 'Google' : 'Apple'} estará disponível em breve.`)
        } else {
          toast.error(`Erro ao iniciar login com ${provider === 'google' ? 'Google' : 'Apple'}.`)
        }
        setIsOAuthLoading(null)
      }
      // If no error, browser will redirect to OAuth provider
    } catch {
      toast.error("Erro ao iniciar login social.")
      setIsOAuthLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full space-y-6 pt-2 pb-12 fade-up">
      
      {/* Back button */}
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl btn-press" asChild>
          <Link href="/cliente">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="space-y-2 px-1 fade-up-fast" style={{ animationDelay: '50ms' }}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isLogin 
            ? 'Entre para agendar e acompanhar seus horários.' 
            : 'Preencha os dados abaixo para se cadastrar.'}
        </p>
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2.5 fade-up-fast" style={{ animationDelay: '100ms' }}>
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={isOAuthLoading !== null}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border bg-card/50 text-foreground font-medium premium-card hover:border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isOAuthLoading === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continuar com Google
        </button>

        <button
          type="button"
          onClick={() => toast.info('Login com Apple estará disponível em breve.')}
          className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border/40 bg-card/30 text-muted-foreground font-medium cursor-default transition-colors"
        >
          <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continuar com Apple
          <span className="text-[9px] uppercase tracking-widest font-semibold bg-secondary/80 px-1.5 py-0.5 rounded border border-border">Em breve</span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">ou com e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 fade-up-fast" style={{ animationDelay: '150ms' }}>
        {!isLogin && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
            <Input 
              required
              placeholder="Ex: João da Silva"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="bg-background border-input focus-visible:ring-ring focus-visible:border-input h-11 rounded-xl text-sm"
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
          <Input 
            required
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-background border-input focus-visible:ring-ring focus-visible:border-input h-11 rounded-xl text-sm"
            autoComplete="email"
          />
        </div>

        {!isLogin && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Telefone (WhatsApp)</label>
            <Input 
              required
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              className="bg-background border-input focus-visible:ring-ring focus-visible:border-input h-11 rounded-xl text-sm"
              autoComplete="tel"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Senha</label>
          <div className="relative">
            <Input 
              required
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-background border-input focus-visible:ring-ring focus-visible:border-input h-11 rounded-xl text-sm pr-10"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {!isLogin && (
            <p className="text-[10px] text-muted-foreground pl-1">Mínimo de 6 caracteres</p>
          )}
        </div>

        <div className="pt-2">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-semibold rounded-xl premium-cta shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isLogin ? (
              <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> Entrar</span>
            ) : (
              <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Cadastrar</span>
            )}
          </Button>
        </div>
      </form>

      <div className="text-center pt-2">
        <button 
          onClick={() => setIsLogin(!isLogin)}
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium btn-press"
        >
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
        </button>
      </div>

    </div>
  )
}

export default function ClienteLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ClienteLoginContent />
    </Suspense>
  )
}
