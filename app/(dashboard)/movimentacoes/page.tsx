import { MovementsView } from "@/features/movements/components/MovementsView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Movimentações | Barber Zac ERP",
  description: "Histórico e movimentações de estoque",
}

export default function MovimentacoesPage() {
  return (
    <div className="p-6">
      <MovementsView />
    </div>
  )
}
