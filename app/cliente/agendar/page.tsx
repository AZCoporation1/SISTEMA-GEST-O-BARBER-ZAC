import Link from "next/link"
import { ArrowLeft, Clock, DollarSign, Scissors, Sparkles, Wand2, Hand, Droplets, Eye, Paintbrush, PenTool } from "lucide-react"
import { getPublicBookingCatalog } from "@/features/agenda/actions/public-booking.actions"

// Icon resolver: tries service name first, then category name
function resolveServiceIcon(serviceName: string, categoryName: string) {
  const name = (serviceName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const cat = (categoryName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const combined = `${name} ${cat}`

  // Corte / cabelo / social / degradê / fade / tesoura / barba / cavanhaque / bigode
  if (/corte|cabelo|social|degrade|fade|tesoura|barba|cavanhaque|bigode|barboterapia|razor|aparar/.test(combined)) {
    return <Scissors className="w-5 h-5" />
  }
  // Sobrancelha
  if (/sobrancelha/.test(combined)) {
    return <Eye className="w-5 h-5" />
  }
  // Limpeza de pele / skin care / estética / facial
  if (/limpeza|pele|skin|estetica|facial/.test(combined)) {
    return <Sparkles className="w-5 h-5" />
  }
  // Hidratação / tratamento / reconstrução
  if (/hidratacao|tratamento|reconstrucao|cauterizacao/.test(combined)) {
    return <Droplets className="w-5 h-5" />
  }
  // Luzes / reflexo / nevou / platinado / coloração / tintura
  if (/luzes|reflexo|nevou|platinado|coloracao|tintura|mechas/.test(combined)) {
    return <Paintbrush className="w-5 h-5" />
  }
  // Alisamento / progressiva / botox / selagem
  if (/alisamento|progressiva|botox|selagem|quimica/.test(combined)) {
    return <Wand2 className="w-5 h-5" />
  }
  // Massoterapia / massagem / relaxamento
  if (/massoterapia|massagem|relaxamento/.test(combined)) {
    return <Hand className="w-5 h-5" />
  }
  // Depilação / cera / nasal / orelha
  if (/depilacao|cera|nasal|orelha/.test(combined)) {
    return <Sparkles className="w-5 h-5" />
  }
  // Pigmentação / micropigmentação
  if (/pigmentacao|micropigmentacao/.test(combined)) {
    return <PenTool className="w-5 h-5" />
  }
  // Fallback: Scissors for barbershop context
  return <Scissors className="w-5 h-5" />
}

export default async function AgendarServicePage() {
  const result = await getPublicBookingCatalog()

  if (!result.success || !result.data || result.data.length === 0) {
    return (
      <div className="flex flex-col h-full pt-4 space-y-6">
        <div className="flex items-center gap-3 px-4">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Escolha o serviço</h1>
        </div>
        <div className="text-center py-12 text-zinc-500">
          Nenhum serviço disponível para agendamento no momento.
        </div>
      </div>
    )
  }

  const services = result.data
  const uniqueCategories = Array.from(new Set(services.map(s => s.categoryName)))
  const displayCategories = ["Todos", ...uniqueCategories.filter(c => c !== "Todos")]

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in px-4">
      <div className="flex items-center gap-3">
        <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-white">Escolha o serviço</h1>
      </div>

      {/* Horizontal Categories */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 snap-x hide-scrollbar gap-2">
        {displayCategories.map((cat, idx) => (
          <div 
            key={idx}
            className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border
              ${idx === 0 
                ? 'bg-zinc-100 text-zinc-900 border-transparent' 
                : 'bg-zinc-900/50 text-zinc-400 border-zinc-800'}`}
          >
            {cat}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {services.map(service => (
          <Link 
            key={service.id} 
            href={`/cliente/agendar/profissional?serviceId=${service.id}`}
            className="block group"
          >
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-800/50 text-zinc-400 group-hover:text-zinc-300 group-hover:bg-zinc-800 transition-colors">
                {resolveServiceIcon(service.name, service.categoryName)}
              </div>
              
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-zinc-100 truncate">{service.name}</h3>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {service.durationMinutes} min
                  </span>
                  <span className="flex items-center gap-1 font-medium text-zinc-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    {service.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0 pl-2">
                <div className="px-4 py-2 rounded-lg bg-white/5 text-white text-sm font-medium group-hover:bg-white/10 transition-colors">
                  Agendar
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
