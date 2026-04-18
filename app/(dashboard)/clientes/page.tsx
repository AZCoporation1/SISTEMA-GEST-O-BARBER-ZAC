import { Metadata } from "next"
import { CustomersDashboard } from "@/features/customers/components/CustomersDashboard"

export const metadata: Metadata = {
  title: "Clientes",
  description: "Gestão de clientes Barber Zac."
}

export default function CustomersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <CustomersDashboard />
    </div>
  )
}
