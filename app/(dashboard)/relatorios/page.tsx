import { ReportsNavigation } from "@/features/reports/components/ReportsNavigation"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Relatórios | Barber Zac ERP",
  description: "Central de relatórios analíticos do sistema",
}

export default function RelatoriosPage() {
  return (
    <div className="p-6">
      <ReportsNavigation />
    </div>
  )
}
