import { CashDashboardView } from "@/features/cash/components/CashDashboardView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Caixa | Barber Zac ERP",
  description: "Operações e abertura de caixa diário",
}

export default function CaixaPage() {
  return (
    <div className="p-6">
      <CashDashboardView />
    </div>
  )
}
