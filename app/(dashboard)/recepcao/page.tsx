import { ReceptionOverview } from "@/features/reception/components/ReceptionOverview"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Recepção | Barber Zac ERP",
  description: "Gestão administrativa do módulo recepção, salários e adiantamentos",
}

export default function RecepcaoPage() {
  return (
    <div className="p-6">
      <ReceptionOverview />
    </div>
  )
}
