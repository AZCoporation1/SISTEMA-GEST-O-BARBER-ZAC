import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { unstable_cache } from "next/cache"
import { getPublicBookingCatalog } from "@/features/agenda/actions/public-booking.actions"
import ServiceCatalog from "./ServiceCatalog"

// Cache the catalog for 120 seconds — services rarely change
const getCachedCatalog = unstable_cache(
  async () => getPublicBookingCatalog(),
  ['public-booking-catalog'],
  { revalidate: 120 }
)

export default async function AgendarServicePage() {
  const result = await getCachedCatalog()

  if (!result.success || !result.data || result.data.length === 0) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6">
        <div className="flex items-center gap-3 px-4">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Escolha o serviço</h1>
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
        <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Escolha o serviço</h1>
      </div>

      <ServiceCatalog services={result.data} />
    </div>
  )
}
