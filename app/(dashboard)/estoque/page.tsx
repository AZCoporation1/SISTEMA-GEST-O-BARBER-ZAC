import { InventoryView } from "@/features/inventory/components/InventoryView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Estoque | Barber Zac ERP",
  description: "Gestão completa de estoque",
}

export default function EstoquePage() {
  return (
    <div className="p-6">
      <InventoryView />
    </div>
  )
}
