"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, User, Plus, Loader2, AlertTriangle, LogOut, RefreshCw, ShieldAlert, UserPlus } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { getCustomerAppointments, customerLogout, createCustomerForInternalUser } from "@/features/customers/actions/customer-auth.actions"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"

export default function MeusAgendamentosPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [appointments, setAppointments] = useState<any[]>([])
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isInternalUser, setIsInternalUser] = useState(false)
  const [canAccessERP, setCanAccessERP] = useState(false)
  const [erpRedirectPath, setErpRedirectPath] = useState<string | null>(null)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/cliente/login?callbackUrl=/cliente/meus-agendamentos')
      return
    }

    loadAppointments()
  }, [authLoading, user, router])

  async function loadAppointments() {
    setIsLoading(true)
    setError(null)
    const res = await getCustomerAppointments()
    if (!res.success) {
      setError(res.error || "Erro ao carregar agendamentos.")
      setIsInternalUser(res.isInternalUser ?? false)
      setCanAccessERP(res.canAccessERP ?? false)
      setErpRedirectPath((res as any).erpRedirectPath ?? null)
    } else {
      setAppointments(res.data || [])
      setCustomerName(res.customerName || user?.fullName || null)
      setIsInternalUser(res.isInternalUser ?? false)
      setCanAccessERP(res.canAccessERP ?? false)
      setErpRedirectPath((res as any).erpRedirectPath ?? null)
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
      await loadAppointments()
    } else {
      toast.error(res.error || "Erro ao criar perfil de cliente.")
    }
    setIsCreatingCustomer(false)
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  // Error: Internal user (admin/professional) — validated via resolveCustomerAreaIdentity
  if (error && isInternalUser) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meus Agendamentos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-amber-900/20 border border-amber-800/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-zinc-200">Conta do sistema interno</h2>
            <p className="text-sm text-zinc-400 max-w-xs">
              Esta conta pertence ao sistema interno (ERP). Para agendar como cliente, crie um perfil de cliente ou entre com outra conta.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
            {/* ERP button — ONLY if canAccessERP is validated */}
            {canAccessERP && erpRedirectPath && (
              <Link
                href={erpRedirectPath}
                className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
              >
                Voltar ao ERP
              </Link>
            )}
            {/* Create customer profile */}
            <button
              onClick={handleCreateCustomerProfile}
              disabled={isCreatingCustomer}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-semibold transition-colors disabled:opacity-50"
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

  // Error: Customer sync failed (NOT internal)
  if (error) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meus Agendamentos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-800/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-zinc-200">Não foi possível carregar</h2>
            <p className="text-sm text-zinc-400 max-w-xs">{error}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
            <button
              onClick={loadAppointments}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-100 text-zinc-900 font-semibold hover:bg-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium transition-colors border border-zinc-800"
            >
              <LogOut className="w-4 h-4" />
              Sair e entrar com outra conta
            </button>
          </div>
        </div>
      </div>
    )
  }

  const upcoming = appointments.filter(a => new Date(a.start_at) > new Date() && a.status !== 'cancelled')
  const past = appointments.filter(a => new Date(a.start_at) <= new Date() || a.status === 'cancelled')

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meus Agendamentos</h1>
        </div>
      </div>

      <div className="px-1">
        <p className="text-sm text-zinc-400">Olá, <span className="text-zinc-200 font-medium">{customerName || 'Cliente'}</span></p>
      </div>

      <div className="pt-2">
        <Link 
          href="/cliente/agendar"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Link>
      </div>

      {/* Upcoming */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Próximos</h2>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border border-zinc-800/50 bg-zinc-900/30">
            <CalendarDays className="w-10 h-10 text-zinc-700" />
            <p className="text-zinc-500 text-sm text-center">Nenhum agendamento futuro.</p>
            <Link 
              href="/cliente/agendar"
              className="text-sm text-zinc-300 hover:text-white transition-colors underline underline-offset-4"
            >
              Agendar agora
            </Link>
          </div>
        ) : (
          upcoming.map(appt => (
            <AppointmentCard key={appt.id} appt={appt} isUpcoming />
          ))
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-4 pt-6">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Histórico</h2>
          <div className="space-y-3 opacity-70">
            {past.slice(0, 10).map(appt => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AppointmentCard({ appt, isUpcoming = false }: { appt: any, isUpcoming?: boolean }) {
  const date = parseISO(appt.start_at)
  const isCancelled = appt.status === 'cancelled'
  
  return (
    <div className={`p-4 rounded-2xl border ${isUpcoming ? 'border-zinc-700 bg-zinc-800/40' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={`font-semibold ${isCancelled ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
            {appt.service_name_snapshot}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
            <User className="w-3 h-3" />
            <span>{appt.collaborators?.name || 'Profissional'}</span>
          </div>
        </div>
        {isCancelled ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-red-500/10 text-red-400">
            Cancelado
          </span>
        ) : (
          <span className="text-sm font-medium text-zinc-300">
            R$ {appt.service_price_snapshot?.toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4" />
          <span className="capitalize">{format(date, "dd MMM", { locale: ptBR })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{format(date, "HH:mm")}</span>
        </div>
      </div>
    </div>
  )
}
