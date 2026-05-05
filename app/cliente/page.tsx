import Link from 'next/link'
import { CalendarDays, Bot, ArrowRight, Clock, Sparkles } from 'lucide-react'

export default function ClientePage() {
  return (
    <div className="flex flex-col h-full justify-center space-y-10 animate-in fade-in duration-500 pb-16 pt-8">
      
      {/* Hero */}
      <div className="text-center space-y-3 px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/30 text-[11px] text-zinc-400 font-medium mb-2">
          <Clock className="w-3 h-3" />
          Agendamento online 24h
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Agende seu horário
        </h1>
        <p className="text-sm text-zinc-500 max-w-[260px] mx-auto leading-relaxed">
          Escolha o serviço, o profissional e o melhor horário para você.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-3.5">
        {/* Agendamento Manual — Primary */}
        <Link href="/cliente/agendar" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 transition-all duration-200 hover:bg-zinc-800/60 hover:border-zinc-700/60 active:scale-[0.98]">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.06] border border-zinc-700/30 text-zinc-300 group-hover:text-white group-hover:bg-white/[0.1] transition-all duration-200 shadow-inner">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white text-[15px]">Agendar Horário</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Escolha serviço, profissional e horário</p>
                </div>
              </div>
              <ArrowRight className="h-4.5 w-4.5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
            </div>
          </div>
        </Link>

        {/* Agendamento IA — Secondary */}
        <Link href="/cliente/agente" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800/40 bg-zinc-900/30 p-5 transition-all duration-200 hover:bg-zinc-900/50 hover:border-zinc-800/60 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-zinc-800/40 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-zinc-400 group-hover:text-zinc-300 text-[15px] transition-colors">Agente Inteligente</h3>
                    <span className="text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-500 border border-zinc-700/30">Beta</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">Assistente virtual</p>
                </div>
              </div>
              <ArrowRight className="h-4.5 w-4.5 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
            </div>
          </div>
        </Link>
      </div>

      {/* Quick access */}
      <div className="flex items-center justify-center gap-6 pt-2">
        <Link 
          href="/cliente/meus-agendamentos" 
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Meus agendamentos
        </Link>
        <div className="w-px h-3 bg-zinc-800" />
        <Link 
          href="/cliente/perfil" 
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Meu perfil
        </Link>
      </div>

    </div>
  )
}
