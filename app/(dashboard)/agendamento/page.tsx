import { Metadata } from "next"
import AgendaPageClient from "./AgendaPageClient"

export const metadata: Metadata = {
  title: "Agenda | Barber Zac ERP",
  description: "Agenda profissional — agendamentos, bloqueios e comanda integrada",
}

export default function AgendamentoPage() {
  return <AgendaPageClient />
}
