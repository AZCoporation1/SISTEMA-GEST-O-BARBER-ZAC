import { createServerClient } from "@/lib/supabase/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, Clock, User, LogOut, Plus } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { customerLogout } from "@/features/customers/actions/customer-auth.actions"

export default async function MeusAgendamentosPage() {
  const supabase = await createServerClient()
  
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) {
    redirect('/cliente/login')
  }

  // Fetch customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name')
    .eq('auth_user_id', authData.user.id)
    .single() as { data: any }

  if (!customer) {
    // Should theoretically never happen due to middleware/auth-provider rules, but just in case
    return <div className="p-4 text-white">Conta de cliente não encontrada.</div>
  }

  // Fetch appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id,
      start_at,
      status,
      service_name_snapshot,
      service_price_snapshot,
      professional_id,
      collaborators (name)
    `)
    .eq('customer_id', customer.id)
    .order('start_at', { ascending: false }) as { data: any[] | null }

  const upcoming = appointments?.filter(a => new Date(a.start_at) > new Date() && a.status !== 'cancelled') || []
  const past = appointments?.filter(a => new Date(a.start_at) <= new Date() || a.status === 'cancelled') || []

  return (
    <div className="flex flex-col h-full space-y-6 pt-4 pb-12 animate-in fade-in">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cliente" className="p-2 -ml-2 rounded-full hover:bg-zinc-800/50 text-zinc-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-white">Meus Agendamentos</h1>
        </div>
        <form action={async () => {
          "use server"
          await customerLogout()
        }}>
          <button type="submit" className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/50 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="px-1">
        <p className="text-sm text-zinc-400">Olá, <span className="text-zinc-200 font-medium">{customer.full_name}</span></p>
      </div>

      <div className="pt-2">
        <Link 
          href="/cliente/agendar"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Link>
      </div>

      {/* Upcoming */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Próximos</h2>
        {upcoming.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-zinc-800/50 bg-zinc-900/30 text-zinc-500 text-sm">
            Nenhum agendamento futuro.
          </div>
        ) : (
          upcoming.map(appt => (
            <AppointmentCard key={appt.id} appt={appt} isUpcoming />
          ))
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-4 pt-6">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Histórico</h2>
          <div className="space-y-3 opacity-70">
            {past.slice(0, 10).map(appt => (
              <AppointmentCard key={appt.id} appt={appt} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function AppointmentCard({ appt, isUpcoming = false }: { appt: any, isUpcoming?: boolean }) {
  const date = parseISO(appt.start_at)
  const isCancelled = appt.status === 'cancelled'
  
  return (
    <div className={`p-4 rounded-2xl border ${isUpcoming ? 'border-zinc-700 bg-zinc-800/40' : 'border-zinc-800 bg-zinc-900/20'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={`font-semibold ${isCancelled ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
            {appt.service_name_snapshot}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
            <User className="w-3 h-3" />
            <span>{appt.collaborators?.name || 'Profissional'}</span>
          </div>
        </div>
        {isCancelled ? (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-red-500/10 text-red-400">
            Cancelado
          </span>
        ) : (
          <span className="text-sm font-medium text-zinc-300">
            R$ {appt.service_price_snapshot?.toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4" />
          <span className="capitalize">{format(date, "dd MMM", { locale: ptBR })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{format(date, "HH:mm")}</span>
        </div>
      </div>
    </div>
  )
}
