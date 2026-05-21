import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getPublicBookingCatalogV2, getPublicBookingCatalog } from "@/features/agenda/actions/public-booking.actions"
import AgendarClientContent from "./AgendarClientContent"

export default async function AgendarServicePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const params = await searchParams
  const mode = params.mode || 'hub'

  // Fetch both catalogs in parallel (no cache wrapper — page is dynamic)
  const [resultV2, resultLegacy] = await Promise.all([
    getPublicBookingCatalogV2(),
    getPublicBookingCatalog(),
  ])

  const hasV2 = resultV2.success && resultV2.data && resultV2.data.length > 0
  const hasLegacy = resultLegacy.success && resultLegacy.data && resultLegacy.data.length > 0

  if (!hasV2 && !hasLegacy) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6">
        <div className="flex items-center gap-3 px-4">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Agendar horário</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          Nenhum serviço disponível para agendamento no momento.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      <div className="flex items-center gap-3">
        <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors btn-press">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Agendar horário</h1>
      </div>

      <AgendarClientContent
        mode={mode}
        servicesV2={hasV2 ? resultV2.data! : []}
        servicesLegacy={hasLegacy ? resultLegacy.data! : []}
      />
    </div>
  )
}
