import Link from 'next/link'
import { CalendarDays, Bot, ArrowRight, Clock, Sparkles } from 'lucide-react'

export default function ClientePage() {
  return (
    <div className="flex flex-col h-full justify-center space-y-10 animate-in fade-in duration-500 pb-16 pt-8">
      
      {/* Hero */}
      <div className="text-center space-y-3 px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/50 border border-border/50 text-[11px] text-muted-foreground font-medium mb-2">
          <Clock className="w-3 h-3" />
          Agendamento online 24h
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Agende seu horário
        </h1>
        <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
          Escolha o serviço, o profissional e o melhor horário para você.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid gap-3.5">
        {/* Agendamento Manual — Primary */}
        <Link href="/cliente/agendar" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:bg-accent/50 hover:border-border active:scale-[0.98]">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 border border-border text-primary/80 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-200 shadow-inner">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground text-[15px]">Agendar Horário</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Escolha serviço, profissional e horário</p>
                </div>
              </div>
              <ArrowRight className="h-4.5 w-4.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
            </div>
          </div>
        </Link>

        {/* Agendamento IA — Secondary */}
        <Link href="/cliente/agente" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-5 transition-all duration-200 hover:bg-accent/30 hover:border-border active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 border border-border/50 text-muted-foreground group-hover:text-foreground transition-colors">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-muted-foreground group-hover:text-foreground text-[15px] transition-colors">Agente Inteligente</h3>
                    <span className="text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-accent text-accent-foreground border border-border/50">Beta</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Assistente virtual</p>
                </div>
              </div>
              <ArrowRight className="h-4.5 w-4.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors shrink-0" />
            </div>
          </div>
        </Link>
      </div>

      {/* Quick access */}
      <div className="flex items-center justify-center gap-6 pt-2">
        <Link 
          href="/cliente/meus-agendamentos" 
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Meus agendamentos
        </Link>
        <div className="w-px h-3 bg-border" />
        <Link 
          href="/cliente/perfil" 
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Meu perfil
        </Link>
      </div>

    </div>
  )
}
