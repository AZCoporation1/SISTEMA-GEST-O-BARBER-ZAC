import { CommissionsDashboard } from "@/features/commissions/components/CommissionsDashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Comissões | Barber Zac ERP",
  description: "Extrato e fechamento de comissões por colaborador",
}

export default function ComissoesPage() {
  return (
    <div className="p-6">
      <CommissionsDashboard />
    </div>
  )
}
