"use client"

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react'
import { customerLogin, customerSignUp } from '@/features/customers/actions/customer-auth.actions'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ClienteLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl') || '/cliente/meus-agendamentos'
  // Validate: only accept internal /cliente paths
  const callbackUrl = rawCallback.startsWith('/cliente') ? rawCallback : '/cliente/meus-agendamentos'
  
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
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
            // Signup succeeded but auto-login failed — show login form
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

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" asChild>
          <Link href="/cliente">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white">
          {isLogin ? 'Acesse sua conta' : 'Crie sua conta'}
        </h1>
        <p className="text-sm text-zinc-400">
          {isLogin 
            ? 'Para continuar com o agendamento, faça login.' 
            : 'Preencha os dados abaixo para se cadastrar.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Nome completo</label>
            <Input 
              required
              placeholder="Ex: João da Silva"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">E-mail</label>
          <Input 
            required
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
            autoComplete="email"
          />
        </div>

        {!isLogin && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Telefone (WhatsApp)</label>
            <Input 
              required
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={e => handlePhoneChange(e.target.value)}
              className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700"
              autoComplete="tel"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">Senha</label>
          <div className="relative">
            <Input 
              required
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-zinc-900 border-zinc-800 focus-visible:ring-zinc-700 pr-10"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {!isLogin && (
            <p className="text-[10px] text-zinc-600">Mínimo de 6 caracteres</p>
          )}
        </div>

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-zinc-100 text-zinc-900 hover:bg-white h-12 mt-4 font-semibold"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isLogin ? (
            <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> Entrar</span>
          ) : (
            <span className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Cadastrar</span>
          )}
        </Button>
      </form>

      <div className="text-center pt-4">
        <button 
          onClick={() => setIsLogin(!isLogin)}
          type="button"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
        </button>
      </div>

    </div>
  )
}
