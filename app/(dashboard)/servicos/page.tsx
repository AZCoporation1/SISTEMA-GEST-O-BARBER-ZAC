import { ServicesDashboard } from "@/features/services/components/ServicesDashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Serviços | Barber Zac ERP",
  description: "Gestão do catálogo de serviços",
}

export default function ServicesPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6 animate-in fade-in zoom-in duration-300">
      <ServicesDashboard />
    </div>
  )
}
