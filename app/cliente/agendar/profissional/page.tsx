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
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Serviço indisponível</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{serviceResult.error || "Serviço não encontrado ou indisponível para agendamento."}</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
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
          <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Escolha o profissional</h1>
        </div>
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">Nenhum profissional disponível para agendamento no momento.</p>
          <Link href="/cliente/agendar" className="inline-flex px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
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
        <Link href="/cliente/agendar" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Escolha o profissional</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{service.name}</p>
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
              <div className="p-4 rounded-2xl border border-border bg-card/50 hover:bg-accent/50 hover:border-border transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/50 to-accent flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors">
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
                <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
