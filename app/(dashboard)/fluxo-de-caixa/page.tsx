import { CashFlowDashboard } from "@/features/cash-flow/components/CashFlowDashboard"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Fluxo de Caixa | Barber Zac ERP",
  description: "DRE simplificado e fluxo financeiro geral",
}

export default function FluxoDeCaixaPage() {
  return (
    <div className="p-6">
      <CashFlowDashboard />
    </div>
  )
}
