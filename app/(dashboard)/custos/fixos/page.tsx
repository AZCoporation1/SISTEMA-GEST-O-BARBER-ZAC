import { FixedCostsView } from "@/features/costs/components/FixedCostsView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Custos Fixos | Barber Zac ERP",
  description: "Despesas recorrentes do salão",
}

export default function CustosFixosPage() {
  return (
    <div className="p-6">
      <FixedCostsView />
    </div>
  )
}
