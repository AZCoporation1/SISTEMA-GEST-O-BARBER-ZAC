"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Clock, DollarSign } from 'lucide-react'
import { getCustomerAvailableSlots, Slot } from '@/features/agenda/services/availability.service'
import { getPublicBookingComposition } from '@/features/agenda/actions/public-booking.actions'
import { addDays, format, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function DataHoraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')
  const professionalId = searchParams.get('professionalId')
  const addonsParam = searchParams.get('addons') || ''

  const addonIds = addonsParam ? addonsParam.split(',').filter(Boolean) : []

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday())
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Composition state — loaded once from server
  const [composition, setComposition] = useState<{
    totalDurationMinutes: number
    totalPrice: number
    displayName: string
    items: Array<{ name: string; role: string }>
  } | null>(null)
  const [compositionLoading, setCompositionLoading] = useState(true)

  const missingParams = !serviceId || !professionalId

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchGenRef = useRef(0)

  const today = startOfToday()
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(today, i))

  // Load composition from server (SOURCE OF TRUTH for duration)
  useEffect(() => {
    if (missingParams) {
      setCompositionLoading(false)
      return
    }
    async function loadComposition() {
      try {
        const res = await getPublicBookingComposition(serviceId!, addonIds)
        if (res.success && res.data) {
          setComposition({
            totalDurationMinutes: res.data.totalDurationMinutes,
            totalPrice: res.data.totalPrice,
            displayName: res.data.displayName,
            items: res.data.items.map(i => ({ name: i.name, role: i.role })),
          })
        }
      } catch { /* silent */ }
      setCompositionLoading(false)
    }
    loadComposition()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, addonsParam])

  const loadSlots = useCallback(async (date: Date, gen: number) => {
    if (!composition) return
    setIsLoading(true)
    setError(null)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      // USE COMPOSED DURATION — not just service duration
      const res = await getCustomerAvailableSlots({
        serviceId: serviceId!,
        professionalId: professionalId!,
        date: dateStr,
        durationOverrideMinutes: composition.totalDurationMinutes,
      })
      if (gen !== fetchGenRef.current) return
      if (res.success) {
        setSlots(res.data || [])
      } else {
        setError(res.error || "Erro ao carregar horários")
      }
    } catch {
      if (gen !== fetchGenRef.current) return
      setError("Erro interno ao carregar horários")
    } finally {
      if (gen === fetchGenRef.current) {
        setIsLoading(false)
      }
    }
  }, [serviceId, professionalId, composition])

  useEffect(() => {
    if (missingParams || !composition) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const gen = ++fetchGenRef.current
      loadSlots(selectedDate, gen)
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [selectedDate, loadSlots, missingParams, composition])

  const handleSlotSelect = (time: string) => {
    if (missingParams) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const addonsQuery = addonsParam ? `&addons=${addonsParam}` : ''
    const url = `/cliente/agendar/confirmacao?serviceId=${serviceId}&professionalId=${professionalId}${addonsQuery}&date=${dateStr}&time=${time}`
    router.push(url)
  }

  if (missingParams) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Parâmetros ausentes</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">Serviço ou profissional não selecionado.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors btn-press">
            Voltar e escolher um serviço
          </Link>
        </div>
      </div>
    )
  }

  if (compositionLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const backQuery = addonsParam ? `&addons=${addonsParam}` : ''

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up">
      <div className="flex items-center gap-3">
        <Link 
          href={`/cliente/agendar/profissional?serviceId=${serviceId}${backQuery}`} 
          className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Escolha a data e hora</h1>
      </div>

      {/* Composition summary */}
      {composition && (
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 fade-up-fast">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground line-clamp-1">{composition.displayName}</p>
              {composition.items.length > 1 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {composition.items.map(i => i.name).join(' + ')}
                </p>
              )}
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {composition.totalDurationMinutes}min
              </div>
              <p className="text-sm font-bold text-foreground flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" />
                {composition.totalPrice.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Horizontal Calendar */}
        <div className="flex overflow-x-auto pb-4 -mx-4 px-4 snap-x hide-scrollbar gap-3">
          {dates.map((date, idx) => {
            const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
            const dayName = format(date, 'EEE', { locale: ptBR }).replace('.', '').toUpperCase()
            const dayNum = format(date, 'dd')

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`snap-center shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center btn-press border
                  ${isSelected 
                    ? 'bg-primary text-primary-foreground border-transparent shadow-lg scale-105 selected-ring' 
                    : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground hover:border-primary/20'}`}
              >
                <span className={`text-xs font-medium mb-1 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {dayName}
                </span>
                <span className={`text-xl font-bold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>

        {/* Time Slots */}
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Horários para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>

          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive text-sm fade-up-fast">{error}</div>
          ) : slots.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground bg-card/50 rounded-2xl border border-border fade-up-fast">
              <CalendarIcon className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhum horário disponível nesta data.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSlotSelect(slot.time)}
                  className="h-12 rounded-xl border border-border bg-card slot-tap hover:bg-primary hover:text-primary-foreground hover:border-transparent hover:shadow-md text-foreground font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring fade-up"
                  style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgendarDataHoraPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DataHoraContent />
    </Suspense>
  )
}
