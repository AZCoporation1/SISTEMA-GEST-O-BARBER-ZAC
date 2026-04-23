import { PerfumeSalesDashboard } from "@/features/perfumes/components/PerfumeSalesDashboard"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vendas de Perfumes | Barber Zac",
  description: "Registro, clientes, parcelas e controle de recebíveis de perfumes.",
}

export default function PerfumesPage() {
  return <PerfumeSalesDashboard />
}
