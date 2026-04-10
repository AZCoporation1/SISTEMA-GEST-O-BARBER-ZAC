import { CostsDashboard } from "@/features/costs/components/CostsDashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Custos | Barber Zac ERP",
  description: "Gestão de custos fixos e variáveis",
}

export default function CustosPage() {
  return (
    <div className="p-6">
      <CostsDashboard />
    </div>
  )
}
