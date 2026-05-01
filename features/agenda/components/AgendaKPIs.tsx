"use client"

import { useMemo } from "react"
import { Calendar, Clock, Users, DollarSign, Lock, Ban, TrendingUp } from "lucide-react"
import type { AppointmentWithRelations, AppointmentBlockRow, ProfessionalForAgenda, ProfessionalWorkingHoursRow } from "../types"

interface Props {
  appointments: AppointmentWithRelations[]
  blocks?: AppointmentBlockRow[]
  workingHours?: ProfessionalWorkingHoursRow[]
  professionals?: ProfessionalForAgenda[]
  loading: boolean
  date?: string
}

export default function AgendaKPIs({ appointments, blocks = [], workingHours = [], professionals = [], loading, date }: Props) {
  const stats = useMemo(() => {
    const active = appointments.filter(a => !["cancelled", "no_show"].includes(a.status))
    const completed = appointments.filter(a => a.status === "completed")
    const noShows = appointments.filter(a => a.status === "no_show")
    const checkedIn = appointments.filter(a => a.status === "checked_in")
    const activeBlocks = blocks.filter(b => b.is_active)

    const totalExpected = active.reduce((sum, a) => sum + (Number(a.service_price_snapshot) || 0), 0)
    const totalRealized = completed.reduce((sum, a) => sum + (Number(a.service_price_snapshot) || 0), 0)

    // Calculate occupation per professional
    let occupationMinutes = 0
    let availableMinutes = 0
    const currentWeekday = date ? new Date(`${date}T12:00:00`).getDay() : new Date().getDay()

    professionals.forEach(p => {
      const wh = workingHours.find(
        h => h.professional_id === p.id && h.weekday === currentWeekday && h.is_active
      )
      if (!wh) return

      const startMin = parseInt(wh.start_time.split(":")[0]) * 60 + parseInt(wh.start_time.split(":")[1])
      const endMin = parseInt(wh.end_time.split(":")[0]) * 60 + parseInt(wh.end_time.split(":")[1])
      let available = endMin - startMin

      // Subtract break
      if (wh.break_start_time && wh.break_end_time) {
        const bsMin = parseInt(wh.break_start_time.split(":")[0]) * 60 + parseInt(wh.break_start_time.split(":")[1])
        const beMin = parseInt(wh.break_end_time.split(":")[0]) * 60 + parseInt(wh.break_end_time.split(":")[1])
        available -= (beMin - bsMin)
      }

      availableMinutes += available

      // Sum appointment durations for this professional
      active.forEach(a => {
        if (a.professional_id !== p.id) return
        const start = new Date(a.start_at).getTime()
        const end = new Date(a.end_at).getTime()
        occupationMinutes += (end - start) / 60000
      })
    })

    const occupationPercent = availableMinutes > 0
      ? Math.min(100, Math.round((occupationMinutes / availableMinutes) * 100))
      : 0

    return { active, completed, noShows, checkedIn, activeBlocks, totalExpected, totalRealized, occupationPercent }
  }, [appointments, blocks, workingHours, professionals, date])

  const kpis = [
    {
      label: "Agendamentos",
      value: loading ? "..." : String(stats.active.length),
      icon: Calendar,
      detail: stats.completed.length > 0 ? `${stats.completed.length} finalizado(s)` : "Nenhum finalizado",
    },
    {
      label: "Faturamento Previsto",
      value: loading ? "..." : `R$ ${stats.totalExpected.toFixed(2)}`,
      icon: DollarSign,
      detail: `Realizado: R$ ${stats.totalRealized.toFixed(2)}`,
    },
    {
      label: "Ocupação",
      value: loading ? "..." : `${stats.occupationPercent}%`,
      icon: TrendingUp,
      detail: `${stats.checkedIn.length} em atendimento`,
    },
    {
      label: "Ausências",
      value: loading ? "..." : String(stats.noShows.length),
      icon: Ban,
      detail: stats.noShows.length > 0 ? "Atenção: clientes faltaram" : "Nenhuma ausência",
    },
  ]

  return (
    <div className="kpi-grid">
      {kpis.map(kpi => (
        <div key={kpi.label} className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">{kpi.label}</span>
            <div className="kpi-icon">
              <kpi.icon size={16} />
            </div>
          </div>
          <div className="kpi-value">{kpi.value}</div>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{kpi.detail}</span>
        </div>
      ))}
    </div>
  )
}
