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
  const [historyLimit, setHistoryLimit] = useState(10)

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
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error: Internal user (admin/professional) — validated via resolveCustomerAreaIdentity
  if (error && isInternalUser) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meus Agendamentos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-amber-900/20 border border-amber-800/30 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Conta do sistema interno</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Esta conta pertence ao sistema interno (ERP). Para agendar como cliente, crie um perfil de cliente ou entre com outra conta.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
            {/* ERP button — ONLY if canAccessERP is validated */}
            {canAccessERP && erpRedirectPath && (
              <Link
                href={erpRedirectPath}
                className="flex items-center justify-center gap-2 h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors border border-transparent"
              >
                Voltar ao ERP
              </Link>
            )}
            {/* Create customer profile */}
            <button
              onClick={handleCreateCustomerProfile}
              disabled={isCreatingCustomer}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50"
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
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-card hover:bg-accent text-muted-foreground font-medium transition-colors border border-border"
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
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meus Agendamentos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-800/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar</h2>
            <p className="text-sm text-muted-foreground max-w-xs">{error}</p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
            <button
              onClick={loadAppointments}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 h-12 rounded-xl bg-card hover:bg-accent text-muted-foreground font-medium transition-colors border border-border"
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
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Meus Agendamentos</h1>
        </div>
      </div>

      <div className="px-1">
        <p className="text-sm text-muted-foreground">Olá, <span className="text-foreground font-medium">{customerName || 'Cliente'}</span></p>
      </div>

      <div className="pt-2">
        <Link 
          href="/cliente/agendar"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-colors border border-transparent"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Link>
      </div>

      {/* Upcoming */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Próximos</h2>
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border border-border bg-card/50">
            <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm text-center">Nenhum agendamento futuro.</p>
            <Link 
              href="/cliente/agendar"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
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
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Histórico</h2>
          <div className="space-y-3 opacity-70">
            {past.slice(0, historyLimit).map(appt => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
          {past.length > historyLimit && (
            <button
              onClick={() => setHistoryLimit(prev => prev + 10)}
              className="w-full py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-xl hover:bg-accent"
            >
              Carregar mais ({past.length - historyLimit} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AppointmentCard({ appt, isUpcoming = false }: { appt: any, isUpcoming?: boolean }) {
  const date = parseISO(appt.start_at)
  const isCancelled = appt.status === 'cancelled'
  
  return (
    <div className={`p-4 rounded-2xl border ${isUpcoming ? 'border-border bg-secondary/20' : 'border-border bg-card/50'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={`font-semibold ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {appt.service_name_snapshot}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <User className="w-3 h-3" />
            <span>{appt.collaborators?.name || 'Profissional'}</span>
          </div>
        </div>
        {isCancelled ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-destructive/10 text-destructive">
            Cancelado
          </span>
        ) : (
          <span className="text-sm font-medium text-foreground">
            R$ {appt.service_price_snapshot?.toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
