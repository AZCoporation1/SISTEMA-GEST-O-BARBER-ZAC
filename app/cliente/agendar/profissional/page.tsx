import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ChevronRight, Scissors } from "lucide-react"
import { getPublicBookingProfessionals, getPublicBookingService } from "@/features/agenda/actions/public-booking.actions"

export default async function AgendarProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>
}) {
  const params = await searchParams
  const serviceId = params.serviceId

  if (!serviceId) {
    redirect('/cliente/agendar')
  }

  // Validate service via service-role (bypasses RLS)
  const serviceResult = await getPublicBookingService(serviceId)

  if (!serviceResult.success || !serviceResult.data) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6 px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Serviço indisponível</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-zinc-500">{serviceResult.error || "Serviço não encontrado ou indisponível para agendamento."}</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
            Voltar e escolher outro serviço
          </Link>
        </div>
      </div>
    )
  }

  const service = serviceResult.data

  // Fetch professionals via service-role (bypasses RLS)
  const profResult = await getPublicBookingProfessionals()

  if (!profResult.success || !profResult.data || profResult.data.length === 0) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6 px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Escolha o profissional</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-zinc-500">Nenhum profissional disponível para agendamento no momento.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
            Voltar e escolher outro serviço
          </Link>
        </div>
      </div>
    )
  }

  const professionals = profResult.data

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      <div className="flex items-center gap-3">
        <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Escolha o profissional</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{service.name}</p>
        </div>
      </div>

      <div className="space-y-3">
        {professionals.map(prof => {
          const initial = prof.displayName.charAt(0).toUpperCase()
          return (
            <Link 
              key={prof.id} 
              href={`/cliente/agendar/data-hora?serviceId=${serviceId}&professionalId=${prof.id}`}
              className="block group"
            >
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-zinc-500 transition-colors">
                    <span className="text-lg font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors">{initial}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-100">{prof.displayName}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                      <Scissors className="w-3 h-3" />
                      <span>{prof.role}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
