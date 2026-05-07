"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar as CalendarIcon } from 'lucide-react'
import { getCustomerAvailableSlots, Slot } from '@/features/agenda/services/availability.service'
import { addDays, format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function DataHoraContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const serviceId = searchParams.get('serviceId')
  const professionalId = searchParams.get('professionalId')

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday())
  const [slots, setSlots] = useState<Slot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate required params
  const missingParams = !serviceId || !professionalId

  // Debounce ref — prevents rapid-fire fetches on fast date switching
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fetch generation counter — discards stale responses
  const fetchGenRef = useRef(0)

  // Generate 14 days for the horizontal calendar
  const today = startOfToday()
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(today, i))

  const loadSlots = useCallback(async (date: Date, gen: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const res = await getCustomerAvailableSlots({ serviceId: serviceId!, professionalId: professionalId!, date: dateStr })
      // Discard if a newer fetch was initiated
      if (gen !== fetchGenRef.current) return
      if (res.success) {
        setSlots(res.data || [])
      } else {
        setError(res.error || "Erro ao carregar horários")
      }
    } catch (err) {
      if (gen !== fetchGenRef.current) return
      setError("Erro interno ao carregar horários")
    } finally {
      if (gen === fetchGenRef.current) {
        setIsLoading(false)
      }
    }
  }, [serviceId, professionalId])

  useEffect(() => {
    if (missingParams) return

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Debounce 150ms — enough to absorb rapid taps on calendar
    debounceRef.current = setTimeout(() => {
      const gen = ++fetchGenRef.current
      loadSlots(selectedDate, gen)
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [selectedDate, loadSlots, missingParams])

  const handleSlotSelect = (time: string) => {
    if (missingParams) return
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const url = `/cliente/agendar/confirmacao?serviceId=${serviceId}&professionalId=${professionalId}&date=${dateStr}&time=${time}`
    router.push(url)
  }

  if (missingParams) {
    return (
      <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Parâmetros ausentes</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">Serviço ou profissional não selecionado.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            Voltar e escolher um serviço
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in">
      <div className="flex items-center gap-3">
        <Link 
          href={`/cliente/agendar/profissional?serviceId=${serviceId}`} 
          className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Escolha a data e hora</h1>
      </div>

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
                className={`snap-center shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all border
                  ${isSelected 
                    ? 'bg-primary text-primary-foreground border-transparent shadow-md scale-105' 
                    : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'}`}
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
            /* Skeleton grid instead of spinner */
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-accent animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-border">
              Nenhum horário disponível nesta data.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSlotSelect(slot.time)}
                  className="h-12 rounded-xl border border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-transparent text-foreground font-medium transition-all"
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
