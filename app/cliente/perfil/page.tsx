"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, User, Mail, Phone, Award, Calendar, Camera, LogOut, Pencil, Check, X, ShieldAlert, UserPlus } from 'lucide-react'
import { getCustomerProfile, updateCustomerProfile, customerLogout, createCustomerForInternalUser } from '@/features/customers/actions/customer-auth.actions'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ThemeToggle } from '@/components/theme-toggle'

interface ProfileData {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  loyaltyPoints: number
  memberSince: string
  upcomingAppointments: number
}

export default function PerfilPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInternalUser, setIsInternalUser] = useState(false)
  const [canAccessERP, setCanAccessERP] = useState(false)
  const [erpRedirectPath, setErpRedirectPath] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/cliente/login?callbackUrl=/cliente/perfil')
      return
    }

    loadProfile()
  }, [authLoading, user, router])

  async function loadProfile() {
    setIsLoading(true)
    setError(null)
    const res = await getCustomerProfile()
    if (!res.success || !res.data) {
      setError(res.error || "Erro ao carregar perfil.")
      setIsInternalUser(res.isInternalUser ?? false)
      setCanAccessERP(res.canAccessERP ?? false)
      setErpRedirectPath(res.erpRedirectPath ?? null)
    } else {
      const data = res.data as ProfileData
      setProfile(data)
      setEditName(data.fullName || '')
      setEditPhone(data.phone || '')
      setIsInternalUser(res.isInternalUser ?? false)
      setCanAccessERP(res.canAccessERP ?? false)
      setErpRedirectPath(res.erpRedirectPath ?? null)
      // If phone is missing (e.g. Google OAuth), auto-enter edit mode
      if (!data.phone) {
        setIsEditing(true)
        setTimeout(() => toast.info("Complete seu telefone para agendar."), 500)
      }
    }
    setIsLoading(false)
  }

  const handleLogout = async () => {
    await customerLogout()
    toast.success("Você saiu da sua conta.")
    router.replace('/cliente')
  }

  const handleCreateCustomerProfile = async () => {
    setIsCreatingCustomer(true)
    const res = await createCustomerForInternalUser()
    if (res.success) {
      toast.success("Perfil de cliente criado! Carregando...")
      await loadProfile() // Reload — should now show customer profile
    } else {
      toast.error(res.error || "Erro ao criar perfil de cliente.")
    }
    setIsCreatingCustomer(false)
  }

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Nome é obrigatório.")
      return
    }
    setIsSaving(true)
    const res = await updateCustomerProfile({
      fullName: editName.trim(),
      phone: editPhone.replace(/\D/g, ''),
    })
    if (res.success) {
      toast.success("Perfil atualizado!")
      setIsEditing(false)
      // Optimistic local state update — avoids full refetch (4+ queries)
      if (profile) {
        setProfile({
          ...profile,
          fullName: editName.trim(),
          phone: editPhone.replace(/\D/g, ''),
        })
      }
    } else {
      toast.error(res.error || "Erro ao atualizar.")
    }
    setIsSaving(false)
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    let formatted = digits
    if (digits.length > 0) formatted = `(${digits.slice(0, 2)}`
    if (digits.length > 2) formatted += `) ${digits.slice(2, 7)}`
    if (digits.length > 7) formatted += `-${digits.slice(7, 11)}`
    setEditPhone(formatted)
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return null
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    return phone
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Internal user — real admin/professional without customer profile
  if (error && isInternalUser) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center success-entrance">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Conta do sistema interno</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Esta conta pertence ao ERP. Para usar a área do cliente, entre com uma conta de cliente ou crie um perfil de cliente.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4 stagger">
            {/* "Voltar ao ERP" — ONLY if canAccessERP is true */}
            {canAccessERP && erpRedirectPath && (
              <Link
                href={erpRedirectPath}
                className="flex items-center justify-center gap-2 h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors border border-border btn-press"
              >
                Voltar ao ERP
              </Link>
            )}
            {/* Create customer profile for testing */}
            <button
              onClick={handleCreateCustomerProfile}
              disabled={isCreatingCustomer}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold premium-cta disabled:opacity-50"
            >
              {isCreatingCustomer ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Criar perfil de cliente para esta conta
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-card hover:bg-accent text-muted-foreground hover:text-foreground font-medium transition-colors border border-border btn-press"
            >
              <LogOut className="w-4 h-4" />
              Sair e entrar como cliente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // General error (NOT internal — sync failure, conflict, etc.)
  if (error || !profile) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-muted-foreground">{error || "Perfil não encontrado."}</p>
          <button onClick={loadProfile} className="text-sm text-foreground underline underline-offset-4 btn-press">Tentar novamente</button>
          <button onClick={handleLogout} className="text-sm text-destructive underline underline-offset-4 btn-press">Sair da conta</button>
        </div>
      </div>
    )
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0][0]?.toUpperCase() || '?'
  }

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors btn-press"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dual identity banner */}
      {isInternalUser && canAccessERP && erpRedirectPath && (
        <div className="p-3 rounded-xl border border-amber-800/30 bg-amber-900/10 flex items-center justify-between gap-3 fade-up-fast">
          <p className="text-xs text-amber-300/80">Você também tem acesso ao ERP.</p>
          <Link href={erpRedirectPath} className="text-xs px-3 py-1.5 rounded-lg bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 transition-colors whitespace-nowrap btn-press">
            Ir ao ERP
          </Link>
        </div>
      )}

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3 py-4 fade-up-fast" style={{ animationDelay: '50ms' }}>
        <div className="relative group">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 via-accent/50 to-accent border-2 border-border group-hover:border-primary/30 flex items-center justify-center text-2xl font-bold text-muted-foreground shadow-lg transition-all duration-300">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(profile.fullName)
            )}
          </div>
          <button 
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-110 transition-all duration-200"
            onClick={() => toast.info("Upload de foto estará disponível em breve.")}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">{profile.fullName}</h2>
          {profile.memberSince && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Cliente desde {format(parseISO(profile.memberSince), "MMM yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 fade-up-fast" style={{ animationDelay: '100ms' }}>
        <div className="p-4 rounded-2xl border border-border bg-card/50 text-center premium-card">
          <Calendar className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-lg font-bold text-foreground">{profile.upcomingAppointments}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Próximos</p>
        </div>
        <div className="p-4 rounded-2xl border border-border bg-card/50 text-center premium-card">
          <Award className="w-5 h-5 text-amber-500/60 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-foreground">{profile.loyaltyPoints}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pontos</p>
        </div>
      </div>

      {/* Profile details */}
      <div className="p-5 rounded-2xl border border-border bg-card/50 space-y-5 shadow-sm fade-up-fast" style={{ animationDelay: '150ms' }}>
        {isEditing ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone</label>
              <input
                value={editPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</label>
              <p className="text-sm text-muted-foreground px-1">{profile.email || '—'}</p>
              <p className="text-[10px] text-muted-foreground">E-mail não pode ser editado diretamente.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-semibold premium-cta hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditName(profile.fullName)
                  setEditPhone(profile.phone || '')
                }}
                className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors btn-press"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome</p>
                <p className="text-sm text-foreground mt-0.5">{profile.fullName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">E-mail</p>
                <p className="text-sm text-foreground mt-0.5">{profile.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</p>
                <p className="text-sm text-foreground mt-0.5">{formatPhone(profile.phone) || '—'}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-3 pt-2 fade-up-fast" style={{ animationDelay: '200ms' }}>
        <Link
          href="/cliente/meus-agendamentos"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors border border-border btn-press"
        >
          <Calendar className="w-4 h-4" />
          Meus Agendamentos
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-card hover:bg-destructive/10 text-destructive font-medium transition-colors border border-border hover:border-destructive/30 btn-press"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
