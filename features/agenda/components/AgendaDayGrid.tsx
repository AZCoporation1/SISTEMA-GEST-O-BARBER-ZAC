"use client"

import { useMemo } from "react"
import { Lock, User, Clock } from "lucide-react"
import type {
  AppointmentWithRelations,
  AppointmentBlockRow,
  ProfessionalForAgenda,
  ProfessionalWorkingHoursRow,
  AgendaSettingsRow,
} from "../types"
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from "../types"

interface Props {
  appointments: AppointmentWithRelations[]
  blocks: AppointmentBlockRow[]
  professionals: ProfessionalForAgenda[]
  workingHours: ProfessionalWorkingHoursRow[]
  settings: AgendaSettingsRow | null
  selectedDate: string
  onSlotClick: (professionalId: string, time: string) => void
  onAppointmentClick: (appointment: AppointmentWithRelations) => void
  onBlockClick?: (block: AppointmentBlockRow) => void
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export default function AgendaDayGrid({
  appointments,
  blocks,
  professionals,
  workingHours,
  settings,
  selectedDate,
  onSlotClick,
  onAppointmentClick,
  onBlockClick,
}: Props) {
  const slotInterval = settings?.slot_interval_minutes || 30
  const openingStr = settings?.opening_time || "07:00"
  const closingStr = settings?.closing_time || "21:00"

  // Get the weekday for working hours lookup
  const selectedDateObj = new Date(selectedDate + "T12:00:00")
  const weekday = selectedDateObj.getDay()

  // Generate time slots
  const timeSlots = useMemo(() => {
    const openMin = timeToMinutes(openingStr)
    const closeMin = timeToMinutes(closingStr)
    const slots: string[] = []
    for (let m = openMin; m < closeMin; m += slotInterval) {
      slots.push(minutesToTime(m))
    }
    return slots
  }, [openingStr, closingStr, slotInterval])

  const SLOT_HEIGHT = 56
  const TIME_COL_WIDTH = 56
  const MIN_COL_WIDTH = 180

  // Helper: get professional working hours for today
  const getProfHours = (profId: string) => {
    return workingHours.find(h => h.professional_id === profId && h.weekday === weekday)
  }

  // Helper: is time within working hours
  const isWithinWorkingHours = (profId: string, time: string) => {
    const ph = getProfHours(profId)
    if (!ph) return false
    const t = timeToMinutes(time)
    const start = timeToMinutes(ph.start_time)
    const end = timeToMinutes(ph.end_time)
    if (t < start || t >= end) return false
    // Check break
    if (ph.break_start_time && ph.break_end_time) {
      const bs = timeToMinutes(ph.break_start_time)
      const be = timeToMinutes(ph.break_end_time)
      if (t >= bs && t < be) return false
    }
    return true
  }

  // Helper: get appointment at a time slot for a professional
  const getAppointmentAtSlot = (profId: string, time: string) => {
    const slotStart = new Date(`${selectedDate}T${time}:00-03:00`).getTime()
    const slotEnd = slotStart + slotInterval * 60 * 1000

    return appointments.find(a => {
      if (a.professional_id !== profId) return false
      const aStart = new Date(a.start_at).getTime()
      const aEnd = new Date(a.end_at).getTime()
      return aStart < slotEnd && aEnd > slotStart
    })
  }

  // Helper: is this the first slot of an appointment
  const isFirstSlotOfAppointment = (appt: AppointmentWithRelations, time: string) => {
    const slotStart = new Date(`${selectedDate}T${time}:00-03:00`).getTime()
    const aStart = new Date(appt.start_at).getTime()
    return Math.abs(aStart - slotStart) < slotInterval * 60 * 1000 && slotStart <= aStart
  }

  // Helper: get appointment height in slots
  const getAppointmentSlotSpan = (appt: AppointmentWithRelations) => {
    const durationMin = appt.service_duration_minutes_snapshot || 30
    return Math.max(1, Math.ceil(durationMin / slotInterval))
  }

  // Helper: find block at slot (returns the block or undefined)
  const getBlockAtSlot = (profId: string, time: string) => {
    const slotStart = new Date(`${selectedDate}T${time}:00-03:00`).getTime()
    const slotEnd = slotStart + slotInterval * 60 * 1000

    return blocks.find(b => {
      if (b.professional_id !== profId) return false
      const bStart = new Date(b.start_at).getTime()
      const bEnd = new Date(b.end_at).getTime()
      return bStart < slotEnd && bEnd > slotStart
    })
  }

  if (professionals.length === 0) {
    return (
      <div className="empty-state">
        <User className="empty-state-icon" />
        <p className="empty-state-title">Nenhum profissional ativo</p>
        <p className="empty-state-description">Cadastre profissionais para usar a agenda.</p>
      </div>
    )
  }

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header — Professional Columns */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--bg-surface)",
      }}>
        <div style={{
          width: TIME_COL_WIDTH,
          minWidth: TIME_COL_WIDTH,
          borderRight: "1px solid var(--border)",
          padding: "12px 8px",
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textAlign: "center",
        }}>
          Hora
        </div>
        {professionals.map(prof => {
          const ph = getProfHours(prof.id)
          return (
            <div
              key={prof.id}
              style={{
                flex: 1,
                minWidth: MIN_COL_WIDTH,
                borderRight: "1px solid var(--border)",
                padding: "10px 12px",
                textAlign: "center",
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}>
                {prof.display_name || prof.name}
              </div>
              {ph && (
                <div style={{
                  fontSize: 9,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}>
                  {ph.start_time.slice(0, 5)} — {ph.end_time.slice(0, 5)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid Body */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 340px)" }}>
        {timeSlots.map((time, slotIdx) => (
          <div
            key={time}
            style={{
              display: "flex",
              height: SLOT_HEIGHT,
              borderBottom: "1px solid var(--border)",
            }}
          >
            {/* Time label */}
            <div style={{
              width: TIME_COL_WIDTH,
              minWidth: TIME_COL_WIDTH,
              borderRight: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {time}
            </div>

            {/* Professional cells */}
            {professionals.map(prof => {
              const withinHours = isWithinWorkingHours(prof.id, time)
              const blockAtSlot = getBlockAtSlot(prof.id, time)
              const appointment = getAppointmentAtSlot(prof.id, time)
              const isFirst = appointment ? isFirstSlotOfAppointment(appointment, time) : false

              // Outside working hours
              if (!withinHours) {
                return (
                  <div
                    key={prof.id}
                    style={{
                      flex: 1,
                      minWidth: MIN_COL_WIDTH,
                      borderRight: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.015)",
                    }}
                  />
                )
              }

              // Blocked slot — now clickable
              if (blockAtSlot) {
                return (
                  <div
                    key={prof.id}
                    onClick={() => onBlockClick?.(blockAtSlot)}
                    style={{
                      flex: 1,
                      minWidth: MIN_COL_WIDTH,
                      borderRight: "1px solid var(--border)",
                      background: "rgba(55,65,81,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      cursor: onBlockClick ? "pointer" : "default",
                      transition: "background 100ms ease",
                    }}
                    onMouseEnter={e => {
                      if (onBlockClick) (e.currentTarget as HTMLElement).style.background = "rgba(55,65,81,0.22)"
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(55,65,81,0.12)"
                    }}
                  >
                    <Lock size={11} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>BLOQUEADO</span>
                  </div>
                )
              }

              // Appointment slot
              if (appointment && isFirst) {
                let colors = APPOINTMENT_STATUS_COLORS[appointment.status] || APPOINTMENT_STATUS_COLORS.scheduled
                if (appointment.source === 'customer' && appointment.status === 'scheduled') {
                  colors = { bg: "rgba(20, 184, 166, 0.1)", border: "rgba(20, 184, 166, 0.3)", text: "#2dd4bf" }
                }
                const span = getAppointmentSlotSpan(appointment)

                return (
                  <div
                    key={prof.id}
                    style={{
                      flex: 1,
                      minWidth: MIN_COL_WIDTH,
                      borderRight: "1px solid var(--border)",
                      padding: 3,
                      position: "relative",
                    }}
                  >
                    <button
                      onClick={() => onAppointmentClick(appointment)}
                      style={{
                        position: "absolute",
                        top: 3,
                        left: 3,
                        right: 3,
                        height: span * SLOT_HEIGHT - 6,
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "6px 8px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                        overflow: "hidden",
                        textAlign: "left",
                        zIndex: 5,
                        transition: "transform 100ms ease, box-shadow 100ms ease",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"
                        ;(e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)"
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.transform = "scale(1)"
                        ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                      }}
                    >
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: colors.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        lineHeight: 1.3,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}>
                        {appointment.customer_name_snapshot || "Cliente"}
                        {appointment.source === 'customer' && (
                          <span style={{ color: "var(--accent)", display: "inline-flex" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 9,
                        color: colors.text,
                        opacity: 0.8,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        marginTop: 1,
                      }}>
                        {appointment.service_name_snapshot || "Serviço"}
                        {appointment.source === 'customer' && " • App Cliente"}
                      </div>
                      {span > 1 && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          marginTop: 3,
                          fontSize: 8,
                          fontWeight: 600,
                          color: colors.text,
                          opacity: 0.7,
                        }}>
                          <Clock size={8} />
                          {appointment.service_duration_minutes_snapshot || 30}min
                          <span style={{
                            marginLeft: "auto",
                            padding: "1px 4px",
                            borderRadius: 3,
                            background: "rgba(0,0,0,0.15)",
                            fontSize: 7,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}>
                            {APPOINTMENT_STATUS_LABELS[appointment.status]}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                )
              }

              // Continuation of multi-slot appointment (do not render another card)
              if (appointment && !isFirst) {
                return (
                  <div
                    key={prof.id}
                    style={{
                      flex: 1,
                      minWidth: MIN_COL_WIDTH,
                      borderRight: "1px solid var(--border)",
                    }}
                  />
                )
              }

              // Empty slot — clickable
              return (
                <div
                  key={prof.id}
                  onClick={() => onSlotClick(prof.id, time)}
                  style={{
                    flex: 1,
                    minWidth: MIN_COL_WIDTH,
                    borderRight: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "background 100ms ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(184,184,184,0.04)"
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent"
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
