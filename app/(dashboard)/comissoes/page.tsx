import { ProfessionalsOverview } from "@/features/commissions/components/ProfessionalsOverview"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profissionais & Comissões | Barber Zac ERP",
  description: "Gestão de produção, adiantamentos e fechamentos quinzenais por profissional",
}

export default function ComissoesPage() {
  return (
    <div className="p-6">
      <ProfessionalsOverview />
    </div>
  )
}
