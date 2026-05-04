import Link from 'next/link'
import { Bot, ArrowLeft } from 'lucide-react'

export default function AgentePlaceholderPage() {
  return (
    <div className="flex flex-col h-full justify-center items-center text-center space-y-6 animate-in fade-in duration-500 pb-12">
      
      <div className="relative w-24 h-24 flex items-center justify-center">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="relative w-16 h-16 bg-zinc-800 rounded-2xl border border-zinc-700 flex items-center justify-center shadow-lg overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent"></div>
          <Bot className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      <div className="space-y-3 max-w-sm px-4">
        <h2 className="text-xl font-bold text-white">Agente Inteligente</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          O Agente IA do Instituto Barber Zac está sendo preparado para uma experiência de agendamento ainda mais inteligente e personalizada.
        </p>
        <div className="inline-block mt-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
          Em breve
        </div>
      </div>

      <div className="pt-8">
        <Link 
          href="/cliente/agendar" 
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Agendamento Manual
        </Link>
      </div>

    </div>
  )
}
