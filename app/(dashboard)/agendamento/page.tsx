import { Metadata } from "next"
import { Calendar } from "lucide-react"

export const metadata: Metadata = {
  title: "Agendamento | Barber Zac ERP",
  description: "Módulo de agendamento online - em breve",
}

export default function AgendamentoPage() {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-[60vh] text-center">
      <Calendar className="h-20 w-20 text-muted-foreground/30 mb-6" />
      <h2 className="text-2xl font-bold tracking-tight mb-2">Agendamento</h2>
      <p className="text-muted-foreground max-w-md">
        O módulo de agendamento online estará disponível em breve. 
        Aqui você poderá gerenciar a agenda de cortes, colorações e demais serviços por colaborador.
      </p>
    </div>
  )
}
