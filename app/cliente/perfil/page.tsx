"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, User, Mail, Phone, Award, Calendar, Camera, LogOut, Pencil, Check, X, ShieldAlert } from 'lucide-react'
import { getCustomerProfile, updateCustomerProfile, customerLogout } from '@/features/customers/actions/customer-auth.actions'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
    } else {
      setProfile(res.data as ProfileData)
      setEditName(res.data.fullName || '')
      setEditPhone(res.data.phone || '')
      setIsInternalUser(res.isInternalUser ?? false)
    }
    setIsLoading(false)
  }

  const handleLogout = async () => {
    await customerLogout()
    toast.success("Você saiu da sua conta.")
    router.replace('/cliente')
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
      loadProfile()
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
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  // Internal user error
  if (error && isInternalUser) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meu Perfil</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-amber-900/20 border border-amber-800/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-zinc-200">Conta do sistema interno</h2>
            <p className="text-sm text-zinc-400 max-w-xs">
              Esta conta pertence ao ERP. Para usar a área do cliente, entre com uma conta de cliente.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
            >
              Voltar ao ERP
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium transition-colors border border-zinc-800"
            >
              <LogOut className="w-4 h-4" />
              Sair e entrar como cliente
            </button>
          </div>
        </div>
      </div>
    )
  }

  // General error
  if (error || !profile) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meu Perfil</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-zinc-400">{error || "Perfil não encontrado."}</p>
          <button onClick={loadProfile} className="text-sm text-zinc-300 underline underline-offset-4">Tentar novamente</button>
          <button onClick={handleLogout} className="text-sm text-red-400 underline underline-offset-4">Sair da conta</button>
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
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meu Perfil</h1>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-2xl font-bold text-zinc-300 shadow-lg">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(profile.fullName)
            )}
          </div>
          <button 
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            onClick={() => toast.info("Upload de foto estará disponível em breve.")}
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-200">{profile.fullName}</h2>
          {profile.memberSince && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Cliente desde {format(parseISO(profile.memberSince), "MMM yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center">
          <Calendar className="w-5 h-5 text-zinc-500 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-zinc-200">{profile.upcomingAppointments}</p>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Próximos</p>
        </div>
        <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center">
          <Award className="w-5 h-5 text-amber-500/60 mx-auto mb-1.5" />
          <p className="text-lg font-bold text-zinc-200">{profile.loyaltyPoints}</p>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Pontos</p>
        </div>
      </div>

      {/* Profile details */}
      <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-5">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Nome</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Telefone</label>
              <input
                value={editPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">E-mail</label>
              <p className="text-sm text-zinc-400 px-1">{profile.email || '—'}</p>
              <p className="text-[10px] text-zinc-600">E-mail não pode ser editado diretamente.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-zinc-100 text-zinc-900 font-semibold hover:bg-white disabled:opacity-50 transition-colors"
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
                className="flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Nome</p>
                <p className="text-sm text-zinc-200 mt-0.5">{profile.fullName}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">E-mail</p>
                <p className="text-sm text-zinc-200 mt-0.5">{profile.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Telefone</p>
                <p className="text-sm text-zinc-200 mt-0.5">{formatPhone(profile.phone) || '—'}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="space-y-3 pt-2">
        <Link
          href="/cliente/meus-agendamentos"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
        >
          <Calendar className="w-4 h-4" />
          Meus Agendamentos
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-red-400 font-medium transition-colors border border-zinc-800"
        >
          <LogOut className="w-4 h-4" />
          Sair da conta
        </button>
      </div>
    </div>
  )
}
