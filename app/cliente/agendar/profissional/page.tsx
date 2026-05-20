import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ChevronRight, Scissors } from "lucide-react"
import { getPublicBookingProfessionals, getPublicBookingService, getPublicBookingComposition } from "@/features/agenda/actions/public-booking.actions"

export default async function AgendarProfessionalPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string; addons?: string }>
}) {
  const params = await searchParams
  const serviceId = params.serviceId
  const addonsParam = params.addons || ''

  if (!serviceId) {
    redirect('/cliente/agendar')
  }

  // Parse addon IDs
  const addonIds = addonsParam ? addonsParam.split(',').filter(Boolean) : []

  // Fetch service and composition in parallel
  const [serviceResult, compositionResult, profResult] = await Promise.all([
    getPublicBookingService(serviceId),
    addonIds.length > 0
      ? getPublicBookingComposition(serviceId, addonIds)
      : Promise.resolve(null),
    getPublicBookingProfessionals(),
  ])

  if (!serviceResult.success || !serviceResult.data) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6 px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Serviço indisponível</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{serviceResult.error || "Serviço não encontrado ou indisponível para agendamento."}</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors btn-press">
            Voltar e escolher outro serviço
          </Link>
        </div>
      </div>
    )
  }

  const service = serviceResult.data
  const composition = compositionResult?.success ? compositionResult.data : null

  // Display name: use composition if has addons, else service name
  const displayName = composition?.displayName || service.name
  const totalPrice = composition?.totalPrice || service.price
  const totalDuration = composition?.totalDurationMinutes || service.durationMinutes

  if (!profResult.success || !profResult.data || profResult.data.length === 0) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6 px-4">
        <div className="flex items-center gap-3">
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Escolha o profissional</h1>
        </div>
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Scissors className="w-10 h-10 opacity-30" />
          <p>Nenhum profissional disponível para agendamento no momento.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors btn-press">
            Voltar e escolher outro serviço
          </Link>
        </div>
      </div>
    )
  }

  const professionals = profResult.data
  // Build query string preserving addons
  const addonsQuery = addonsParam ? `&addons=${addonsParam}` : ''

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 fade-up px-4">
      <div className="flex items-center gap-3">
        <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Escolha o profissional</h1>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{displayName}</p>
        </div>
      </div>

      {/* Composition summary */}
      {composition && composition.items && composition.items.length > 1 && (
        <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-sm fade-up-fast">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-primary font-medium">Atendimento montado</p>
              <p className="text-foreground font-semibold text-sm line-clamp-1">{displayName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{totalDuration}min</p>
              <p className="text-sm font-bold text-foreground">R$ {totalPrice.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 stagger">
        {professionals.map(prof => {
          const initial = prof.displayName.charAt(0).toUpperCase()
          return (
            <Link 
              key={prof.id} 
              href={`/cliente/agendar/data-hora?serviceId=${serviceId}${addonsQuery}&professionalId=${prof.id}`}
              className="block group"
            >
              <div className="p-4 rounded-2xl border border-border bg-card/50 premium-card hover:border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/50 to-accent flex items-center justify-center border border-border group-hover:border-primary/30 group-hover:shadow-md transition-all duration-200">
                    <span className="text-lg font-bold text-muted-foreground group-hover:text-foreground transition-colors">{initial}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{prof.displayName}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Scissors className="w-3 h-3" />
                      <span>{prof.role}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-foreground icon-nudge" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
