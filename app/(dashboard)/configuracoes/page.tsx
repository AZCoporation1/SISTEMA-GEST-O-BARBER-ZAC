import { SettingsView } from "@/features/settings/components/SettingsView"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Configurações | Barber Zac ERP",
  description: "Parâmetros globais do sistema",
}

export default function ConfiguracoesPage() {
  return (
    <div className="p-6">
      <SettingsView />
    </div>
  )
}
