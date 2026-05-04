"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Clock, Scissors, CheckCircle2, AlertCircle } from 'lucide-react'
import { createCustomerAppointment } from '@/features/agenda/actions/agenda.actions'
import { getPublicBookingService, getPublicBookingProfessionals } from '@/features/agenda/actions/public-booking.actions'
import { ensureCustomerForAuthUser } from '@/features/customers/actions/customer-auth.actions'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

export default function AgendarConfirmacaoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')
  const professionalId = searchParams.get('professionalId')
  const date = searchParams.get('date')
  const time = searchParams.get('time')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [service, setService] = useState<{ name: string; price: number; durationMinutes: number } | null>(null)
  const [professional, setProfessional] = useState<{ displayName: string } | null>(null)
  const [missingParams, setMissingParams] = useState(false)

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
        // Redirect to login preserving the current booking state
        const currentPath = `/cliente/agendar/confirmacao?serviceId=${serviceId}&professionalId=${professionalId}&date=${date}&time=${time}`
        router.push(`/cliente/login?callbackUrl=${encodeURIComponent(currentPath)}`)
        return
      }

      // Ensure customer record exists for this auth user
      await ensureCustomerForAuthUser(session.user.id, {
        email: session.user.email,
        fullName: session.user.user_metadata?.full_name,
        phone: session.user.user_metadata?.phone,
      })

      // Fetch service and professional data via service-role actions (bypasses RLS)
      const [svcRes, profRes] = await Promise.all([
        getPublicBookingService(serviceId!),
        getPublicBookingProfessionals(),
      ])

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

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      const res = await createCustomerAppointment({
        serviceId: serviceId!,
        professionalId: professionalId!,
        date: date!,
        startTime: time!
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
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Dados incompletos</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="w-12 h-12 text-zinc-600" />
          <p className="text-zinc-500 text-center">Serviço, profissional, data ou horário não selecionados.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
            Voltar e escolher um serviço
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  const dateFormatted = date ? format(parseISO(date), "dd 'de' MMMM, yyyy", { locale: ptBR }) : ''

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      <div className="flex items-center gap-3">
        <Link 
          href={`/cliente/agendar/data-hora?serviceId=${serviceId}&professionalId=${professionalId}`} 
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-white">Confirmação</h1>
      </div>

      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-6">
        
        {/* Service */}
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Serviço</h3>
          <p className="text-lg font-semibold text-white">{service?.name || 'Carregando...'}</p>
          <p className="text-sm text-zinc-400 mt-1">
            R$ {service?.price?.toFixed(2).replace('.', ',') || '0,00'} • {service?.durationMinutes || 0} min
          </p>
        </div>

        {/* Professional */}
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Profissional</h3>
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-zinc-400" />
            <p className="text-base font-medium text-zinc-200">{professional?.displayName || 'Carregando...'}</p>
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Data e Hora</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-200">
              <CalendarIcon className="w-4 h-4 text-zinc-400" />
              <span className="capitalize">{dateFormatted}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-200">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>{time}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="pt-6">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-zinc-100 text-zinc-900 font-semibold hover:bg-white disabled:opacity-50 transition-colors"
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
