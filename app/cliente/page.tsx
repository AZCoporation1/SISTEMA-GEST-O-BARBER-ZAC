import Link from 'next/link'
import { CalendarDays, Bot, ArrowRight, UserCircle } from 'lucide-react'

export default function ClientePage() {
  return (
    <div className="flex flex-col h-full justify-center space-y-8 animate-in fade-in duration-500 pb-12">
      
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">Bem-vindo</h1>
        <p className="text-sm text-zinc-400">Como você prefere agendar seu horário hoje?</p>
      </div>

      <div className="grid gap-4">
        {/* Agendamento Manual */}
        <Link href="/cliente/agendar" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:bg-zinc-800/80 hover:border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700 group-hover:text-white transition-colors">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Agendar Manualmente</h3>
                  <p className="text-sm text-zinc-400">Escolha o serviço e horário</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </div>
          </div>
        </Link>

        {/* Agendamento IA */}
        <Link href="/cliente/agente" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-6 transition-all hover:bg-zinc-900/50">
            <div className="flex items-center justify-between opacity-70 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/50 text-zinc-400">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-300">Agendar com Agente</h3>
                  <p className="text-sm text-zinc-500">Assistente virtual</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </div>
          </div>
        </Link>
      </div>

      <div className="pt-8 text-center">
        <Link 
          href="/cliente/meus-agendamentos" 
          className="inline-flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <UserCircle className="w-4 h-4" />
          Acessar meus agendamentos
        </Link>
      </div>

    </div>
  )
}
