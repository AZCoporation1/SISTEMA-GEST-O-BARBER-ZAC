import { VariableCostsView } from "@/features/costs/components/VariableCostsView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Custos Variáveis | Barber Zac ERP",
  description: "Despesas eventuais listadas no fluxo financeiro",
}

export default function CustosVariaveisPage() {
  return (
    <div className="p-6">
      <VariableCostsView />
    </div>
  )
}
