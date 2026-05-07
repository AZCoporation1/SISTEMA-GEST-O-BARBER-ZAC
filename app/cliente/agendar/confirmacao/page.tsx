"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Clock, Scissors, CheckCircle2, AlertCircle, User, Phone, MessageSquare, RefreshCw, LogOut, ShieldAlert } from 'lucide-react'
import { createCustomerAppointment } from '@/features/agenda/actions/agenda.actions'
import { getPublicBookingService, getPublicBookingProfessionals } from '@/features/agenda/actions/public-booking.actions'
import { ensureCustomerForAuthUser } from '@/features/customers/actions/customer-auth.actions'
import { resolveCustomerAreaIdentity } from '@/features/customers/services/resolve-identity'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

function ConfirmacaoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')
  const professionalId = searchParams.get('professionalId')
  const date = searchParams.get('date')
  const time = searchParams.get('time')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [service, setService] = useState<{ name: string; price: number; durationMinutes: number } | null>(null)
  const [professional, setProfessional] = useState<{ displayName: string } | null>(null)
  const [customerInfo, setCustomerInfo] = useState<{ name: string; phone: string } | null>(null)
  const [customerReady, setCustomerReady] = useState(false)
  const [isInternalUser, setIsInternalUser] = useState(false)
  const [canAccessERP, setCanAccessERP] = useState(false)
  const [erpRedirectPath, setErpRedirectPath] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncCode, setSyncCode] = useState<string | null>(null)
  const [missingParams, setMissingParams] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!serviceId || !professionalId || !date || !time) {
      setMissingParams(true)
      setIsLoading(false)
      return
    }

    async function fetchData() {
      const supabase = createClient()
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const currentPath = `/cliente/agendar/confirmacao?serviceId=${serviceId}&professionalId=${professionalId}&date=${date}&time=${time}`
        router.push(`/cliente/login?callbackUrl=${encodeURIComponent(currentPath)}`)
        return
      }

      // ── Run ALL independent fetches in parallel ──
      // Identity, customer ensure, service data, and professional data
      // are all independent — run them simultaneously to cut latency
      const [identity, ensureResult, svcRes, profRes] = await Promise.all([
        resolveCustomerAreaIdentity(session.user.id, session.user.email),
        ensureCustomerForAuthUser(session.user.id, {
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          phone: session.user.user_metadata?.phone,
        }),
        getPublicBookingService(serviceId!),
        getPublicBookingProfessionals(),
      ])

      // Process identity result
      if (identity.hasUserProfile) {
        setIsInternalUser(true)
        setCanAccessERP(identity.canAccessERP)
        setErpRedirectPath(identity.erpRedirectPath)
      }

      // Process customer ensure result
      if (ensureResult.success && ensureResult.customerId) {
        setCustomerReady(true)
        setCustomerInfo({
          name: ensureResult.fullName || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Cliente',
          phone: ensureResult.phone || session.user.user_metadata?.phone || '',
        })
        setSyncError(null)
        setSyncCode(null)
      } else {
        setCustomerReady(false)
        setSyncError(ensureResult.error || "Não foi possível vincular seu registro de cliente.")
        setSyncCode(ensureResult.code || null)
      }

      if (svcRes.success && svcRes.data) {
        setService(svcRes.data)
      }

      if (profRes.success && profRes.data) {
        const prof = profRes.data.find(p => p.id === professionalId)
        if (prof) {
          setProfessional({ displayName: prof.displayName })
        }
      }

      setIsLoading(false)
    }

    fetchData()
  }, [serviceId, professionalId, date, time, router])

  const handleRetrySync = async () => {
    setIsRetrying(true)
    setSyncError(null)
    setSyncCode(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSyncError("Sessão expirada. Faça login novamente.")
      setIsRetrying(false)
      return
    }

    const ensureResult = await ensureCustomerForAuthUser(session.user.id, {
      email: session.user.email,
      fullName: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
      phone: session.user.user_metadata?.phone,
    })

    if (ensureResult.success && ensureResult.customerId) {
      setCustomerReady(true)
      setCustomerInfo({
        name: ensureResult.fullName || session.user.email?.split('@')[0] || 'Cliente',
        phone: ensureResult.phone || '',
      })
      setSyncError(null)
      setSyncCode(null)
      toast.success("Conta vinculada com sucesso!")
    } else {
      setSyncError(ensureResult.error || "Não foi possível vincular.")
      setSyncCode(ensureResult.code || null)
    }
    setIsRetrying(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Você saiu da sua conta.")
    router.replace('/cliente')
  }

  const handleConfirm = async () => {
    if (!customerReady) {
      toast.error("Registro de cliente não vinculado.")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await createCustomerAppointment({
        serviceId: serviceId!,
        professionalId: professionalId!,
        date: date!,
        startTime: time!,
        notes: notes.trim() || undefined,
      })

      if (!res.success) {
        toast.error(res.error)
      } else {
        toast.success("Agendamento confirmado!")
        router.push('/cliente/meus-agendamentos')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (missingParams) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Dados incompletos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground/60" />
          <p className="text-muted-foreground text-center">Serviço, profissional, data ou horário não selecionados.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            Voltar e escolher um serviço
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const dateFormatted = date ? format(parseISO(date), "dd 'de' MMMM, yyyy", { locale: ptBR }) : ''

  // Helper: Get specific error message based on sync code
  const getSyncErrorDisplay = () => {
    if (!syncError) return null

    if (syncCode === 'CONFLICT_EMAIL') {
      return {
        title: "E-mail vinculado a outra conta",
        description: syncError,
        showRetry: false,
      }
    }
    if (syncCode === 'CONFLICT_PHONE') {
      return {
        title: "Telefone vinculado a outra conta",
        description: syncError,
        showRetry: false,
      }
    }
    if (syncCode === 'AUTH_USER_NOT_FOUND') {
      return {
        title: "Conta não encontrada",
        description: "Sua sessão pode ter expirado. Saia e entre novamente.",
        showRetry: false,
      }
    }
    // Technical errors — allow retry
    return {
      title: "Erro ao vincular conta",
      description: syncError,
      showRetry: true,
    }
  }

  const syncErrorDisplay = getSyncErrorDisplay()

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      <div className="flex items-center gap-3">
        <Link 
          href={`/cliente/agendar/data-hora?serviceId=${serviceId}&professionalId=${professionalId}`} 
          className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Confirmação</h1>
      </div>

      {/* Internal user warning */}
      {isInternalUser && !customerReady && (
        <div className="p-4 rounded-2xl border border-amber-800/40 bg-amber-900/10 text-amber-300 text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium">Conta do sistema interno</p>
            <p className="text-amber-400/80">Esta conta pertence ao ERP. Para agendar como cliente, saia e entre com uma conta de cliente.</p>
            <div className="flex gap-2 pt-1">
              {canAccessERP && erpRedirectPath && (
                <Link href={erpRedirectPath} className="text-xs px-3 py-1.5 rounded-lg bg-amber-800/30 hover:bg-amber-800/50 transition-colors">
                  Voltar ao ERP
                </Link>
              )}
              <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer sync error — specific messages based on code */}
      {syncErrorDisplay && !isInternalUser && (
        <div className="p-4 rounded-2xl border border-red-800/50 bg-red-900/20 text-red-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-medium">{syncErrorDisplay.title}</p>
            <p className="text-red-400">{syncErrorDisplay.description}</p>
            {syncCode && (
              <p className="text-red-500/60 text-[10px] font-mono">Código: {syncCode}</p>
            )}
            <div className="flex gap-2 pt-1">
              {syncErrorDisplay.showRetry && (
                <button
                  onClick={handleRetrySync}
                  disabled={isRetrying}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-800/30 hover:bg-red-800/50 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Tentar novamente
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" /> Sair e entrar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 rounded-2xl border border-border bg-card/50 space-y-6">
        
        {/* Service */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Serviço</h3>
          <p className="text-lg font-semibold text-foreground">{service?.name || 'Carregando...'}</p>
          <p className="text-sm text-muted-foreground mt-1">
            R$ {service?.price?.toFixed(2).replace('.', ',') || '0,00'} • {service?.durationMinutes || 0} min
          </p>
        </div>

        {/* Professional */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Profissional</h3>
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">{professional?.displayName || 'Carregando...'}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Data e Hora</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-foreground">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span className="capitalize">{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{time}</span>
            </div>
          </div>
        </div>

        {/* Customer */}
        {customerInfo && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Cliente</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{customerInfo.name}</span>
              </div>
              {customerInfo.phone && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{customerInfo.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Observação (opcional)
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alguma observação para o profissional..."
            maxLength={200}
            rows={2}
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

      </div>

      <div className="pt-6">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || !customerReady}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Confirmar Agendamento
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function AgendarConfirmacaoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ConfirmacaoContent />
    </Suspense>
  )
}
