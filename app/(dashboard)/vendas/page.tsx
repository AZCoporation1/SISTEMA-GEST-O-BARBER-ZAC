import { POSView } from "@/features/sales/components/POSView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "PDV (Vendas) | Barber Zac ERP",
  description: "Ponto de venda rápido para produtos e serviços",
}

export default function VendasPage() {
  return (
    <div className="p-6 h-full min-h-screen">
      <POSView />
    </div>
  )
}
