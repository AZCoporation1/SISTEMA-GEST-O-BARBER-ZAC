"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Calendar as CalendarIcon } from 'lucide-react'
import { getCustomerAvailableSlots, Slot } from '@/features/agenda/services/availability.service'
import { addDays, format, isBefore, startOfToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function AgendarDataHoraPage() {
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


  // Generate 14 days for the horizontal calendar
  const today = startOfToday()
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(today, i))

  useEffect(() => {
    if (missingParams) return
    async function loadSlots() {
      setIsLoading(true)
      setError(null)
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const res = await getCustomerAvailableSlots({ serviceId: serviceId!, professionalId: professionalId!, date: dateStr })
        if (res.success) {
          setSlots(res.data || [])
        } else {
          setError(res.error || "Erro ao carregar horários")
        }
      } catch (err) {
        setError("Erro interno ao carregar horários")
      } finally {
        setIsLoading(false)
      }
    }
    loadSlots()
  }, [selectedDate, serviceId, professionalId, missingParams])

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
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Parâmetros ausentes</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-zinc-500">Serviço ou profissional não selecionado.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
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
          className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-white">Escolha a data e hora</h1>
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
                    ? 'bg-zinc-100 text-zinc-900 border-transparent shadow-md scale-105' 
                    : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800/60'}`}
              >
                <span className={`text-xs font-medium mb-1 ${isSelected ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {dayName}
                </span>
                <span className={`text-xl font-bold ${isSelected ? 'text-zinc-900' : 'text-zinc-200'}`}>
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>

        {/* Time Slots */}
        <div className="pt-4 border-t border-zinc-800/50">
          <h3 className="text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Horários para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
              Nenhum horário disponível nesta data.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSlotSelect(slot.time)}
                  className="h-12 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-100 hover:text-zinc-900 hover:border-transparent text-zinc-300 font-medium transition-all"
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
