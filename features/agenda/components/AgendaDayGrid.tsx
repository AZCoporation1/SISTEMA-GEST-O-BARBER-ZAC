"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { Lock, User, Clock, Phone, Globe, FileText, Scissors, CheckCircle } from "lucide-react"
import type {
  AppointmentWithRelations,
  AppointmentBlockRow,
  ProfessionalForAgenda,
  ProfessionalWorkingHoursRow,
  AgendaSettingsRow,
} from "../types"
import { APPOINTMENT_STATUS_COLORS, APPOINTMENT_STATUS_LABELS } from "../types"
import { resolveAppointmentVisual } from "../utils/resolveAppointmentVisual"

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

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch {
    return "--:--"
  }
}

// Visual state resolution is now centralized in resolveAppointmentVisual

function getSaoPauloMinutes(): number {
  const now = new Date()
  const sp = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return sp.getHours() * 60 + sp.getMinutes()
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
  const MIN_COL_WIDTH = 260

  // ── Scroll sync refs ──
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const handleBodyScroll = useCallback(() => {
    if (bodyRef.current && headerRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft
    }
  }, [])

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

  // Helper: get real duration from start_at/end_at
  const getRealDurationMin = (appt: AppointmentWithRelations) => {
    const s = new Date(appt.start_at).getTime()
    const e = new Date(appt.end_at).getTime()
    return Math.max(1, (e - s) / 60000)
  }

  const getAppointmentSlotSpan = (appt: AppointmentWithRelations) => {
    const durationMin = getRealDurationMin(appt)
    return Math.max(1, Math.ceil(durationMin / slotInterval))
  }

  const pxPerMin = SLOT_HEIGHT / slotInterval

  // Current time marker
  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr
  const [nowMinutes, setNowMinutes] = useState(getSaoPauloMinutes)
  useEffect(() => {
    if (!isToday) return
    const iv = setInterval(() => setNowMinutes(getSaoPauloMinutes()), 60000)
    return () => clearInterval(iv)
  }, [isToday])
  const openMinutes = timeToMinutes(openingStr)
  const closeMinutes = timeToMinutes(closingStr)

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
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header — Professional Columns */}
      <div
        ref={headerRef}
        style={{
          display: "flex",
          borderBottom: "2px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg-surface)",
          overflowX: "hidden",
          flexShrink: 0,
        }}
      >
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
          const initial = (prof.display_name || prof.name).charAt(0).toUpperCase()
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 2,
              }}>
                <div style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--accent-subtle)",
                  border: "1px solid var(--accent-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "var(--accent)",
                  flexShrink: 0,
                }}>
                  {initial}
                </div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}>
                  {prof.display_name || prof.name}
                </span>
              </div>
              {ph && (
                <div style={{
                  fontSize: 9,
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}>
                  <Clock size={8} />
                  {ph.start_time.slice(0, 5)} — {ph.end_time.slice(0, 5)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grid Body */}
      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100dvh - 280px)", position: "relative", flex: 1 }}
      >
        {timeSlots.map((time, slotIdx) => {
          const isHourMark = time.endsWith(":00")
          return (
            <div
              key={time}
              style={{
                display: "flex",
                height: SLOT_HEIGHT,
                borderBottom: isHourMark ? "1px solid var(--border)" : "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
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
                fontSize: isHourMark ? 12 : 10,
                fontWeight: isHourMark ? 700 : 500,
                color: isHourMark ? "var(--text-secondary)" : "var(--text-muted)",
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
                        background: "var(--bg-elevated, rgba(128,128,128,0.04))",
                      }}
                    />
                  )
                }

                // Blocked slot
                if (blockAtSlot) {
                  return (
                    <div
                      key={prof.id}
                      onClick={() => onBlockClick?.(blockAtSlot)}
                      style={{
                        flex: 1,
                        minWidth: MIN_COL_WIDTH,
                        borderRight: "1px solid var(--border)",
                        borderBottom: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                        background: "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(107,114,128,0.06) 4px, rgba(107,114,128,0.06) 8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        cursor: onBlockClick ? "pointer" : "default",
                        transition: "background 100ms ease, filter 100ms ease",
                        padding: "0 8px",
                        boxSizing: "border-box",
                      }}
                      onMouseEnter={e => {
                        if (onBlockClick) (e.currentTarget as HTMLElement).style.filter = "brightness(0.92)"
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.filter = "none"
                      }}
                    >
                      <Lock size={10} style={{ color: "var(--text-muted)", opacity: 0.6, flexShrink: 0 }} />
                      <span style={{
                        fontSize: 9,
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}>Bloqueado</span>
                      {blockAtSlot.reason && (
                        <span style={{
                          fontSize: 8,
                          color: "var(--text-muted)",
                          opacity: 0.7,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 80,
                        }}>
                          • {blockAtSlot.reason}
                        </span>
                      )}
                    </div>
                  )
                }

                // Appointment slot — first slot renders the card
                if (appointment && isFirst) {
                  const colors = resolveAppointmentVisual(appointment)
                  const isCompleted = appointment.status === 'completed'
                  const realDur = getRealDurationMin(appointment)
                  const realHeight = realDur * pxPerMin
                  const span = getAppointmentSlotSpan(appointment)
                  const isCompact = span === 1
                  const isNormal = span === 2
                  const isExpanded = span >= 3
                  const startStr = fmtTime(appointment.start_at)
                  const endStr = fmtTime(appointment.end_at)

                  // Build tooltip
                  const tooltipParts = [
                    `${startStr} — ${endStr}`,
                    appointment.customer_name_snapshot || "Cliente",
                    appointment.service_name_snapshot,
                    appointment.customer_phone_snapshot,
                    colors.badge,
                    appointment.notes,
                  ].filter(Boolean)

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
                        title={tooltipParts.join(" · ")}
                        onClick={() => onAppointmentClick(appointment)}
                        style={{
                          position: "absolute",
                          top: 3,
                          left: 3,
                          right: 3,
                          height: realHeight - 6,
                          background: colors.bg,
                          borderLeft: `3.5px solid ${colors.text}`,
                          borderTop: `1px solid ${colors.border}`,
                          borderRight: `1px solid ${colors.border}`,
                          borderBottom: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          padding: isCompact ? "3px 8px" : isExpanded ? "6px 10px" : "5px 10px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: 0,
                          overflow: "hidden",
                          textAlign: "left",
                          zIndex: 5,
                          boxSizing: "border-box",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                          transition: "box-shadow 120ms ease, transform 120ms ease",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.13)`
                          ;(e.currentTarget as HTMLElement).style.transform = "scale(1.01)"
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"
                          ;(e.currentTarget as HTMLElement).style.transform = "scale(1)"
                        }}
                      >
                        {isCompact ? (
                          /* ── Compact (30min / 1 slot): dense horizontal layout ── */
                          <>
                            {/* Row 1: time · client · service · badge */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              width: "100%",
                              minWidth: 0,
                            }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: colors.text,
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                                flexShrink: 0,
                              }}>
                                {startStr}
                              </span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                lineHeight: 1,
                                minWidth: 0,
                              }}>
                                {appointment.customer_name_snapshot || "Cliente"}
                              </span>
                              {appointment.service_name_snapshot && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 400,
                                  color: "var(--text-muted)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  lineHeight: 1,
                                  minWidth: 0,
                                  flexShrink: 1,
                                }}>
                                  · {appointment.service_name_snapshot}
                                </span>
                              )}
                              <span style={{
                                fontSize: 7,
                                fontWeight: 700,
                                padding: "1px 5px",
                                borderRadius: 3,
                                background: colors.badgeBg,
                                color: colors.text,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                flexShrink: 0,
                                lineHeight: "13px",
                                marginLeft: "auto",
                              }}>
                                {isCompleted && <CheckCircle size={8} style={{ marginRight: 2, verticalAlign: 'middle' }} />}
                                {colors.badge}
                              </span>
                              {isCompleted && colors.secondaryBadge && (
                                <span style={{
                                  fontSize: 6,
                                  fontWeight: 600,
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  background: "rgba(0,0,0,0.08)",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  flexShrink: 0,
                                  lineHeight: "11px",
                                }}>
                                  {colors.secondaryBadge}
                                </span>
                              )}
                            </div>
                            {/* Row 2: phone (if fits) */}
                            {appointment.customer_phone_snapshot && (
                              <div style={{
                                fontSize: 9,
                                color: "var(--text-muted)",
                                opacity: 0.7,
                                lineHeight: 1,
                                marginTop: 2,
                                display: "flex",
                                alignItems: "center",
                                gap: 3,
                              }}>
                                <Phone size={7} style={{ flexShrink: 0 }} />
                                {appointment.customer_phone_snapshot}
                              </div>
                            )}
                          </>
                        ) : (
                          /* ── Normal / Expanded: 2+ slots ── */
                          <>
                            {/* Line 1: Time + origin badge */}
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              flexShrink: 0,
                            }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: colors.text,
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                                letterSpacing: "-0.01em",
                              }}>
                                {startStr} — {endStr}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                <span style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: colors.badgeBg,
                                  color: colors.text,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  lineHeight: "14px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}>
                                  {isCompleted && <CheckCircle size={9} />}
                                  {colors.badge}
                                </span>
                                {isCompleted && colors.secondaryBadge && (
                                  <span style={{
                                    fontSize: 7,
                                    fontWeight: 600,
                                    padding: "2px 5px",
                                    borderRadius: 3,
                                    background: "rgba(0,0,0,0.08)",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    lineHeight: "12px",
                                  }}>
                                    {colors.secondaryBadge}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Line 2: Client name */}
                            <div style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "100%",
                              lineHeight: 1.2,
                              marginTop: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}>
                              <User size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                              {appointment.customer_name_snapshot || "Cliente"}
                            </div>

                            {/* Line 3: Service */}
                            <div style={{
                              fontSize: 10,
                              fontWeight: 500,
                              color: "var(--text-secondary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                              marginTop: 2,
                              lineHeight: 1.2,
                            }}>
                              <Scissors size={9} style={{ flexShrink: 0, opacity: 0.6 }} />
                              {appointment.service_name_snapshot || "Serviço"}
                              <span style={{ opacity: 0.4, fontSize: 8 }}>•</span>
                              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 9, opacity: 0.7 }}>
                                {realDur}min
                              </span>
                            </div>

                            {/* Line 4+ — Expanded: phone / notes */}
                            {isExpanded && (
                              <>
                                {appointment.customer_phone_snapshot && (
                                  <div style={{
                                    fontSize: 9,
                                    color: "var(--text-muted)",
                                    opacity: 0.7,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                    marginTop: 3,
                                    lineHeight: 1,
                                  }}>
                                    <Phone size={8} style={{ flexShrink: 0 }} />
                                    {appointment.customer_phone_snapshot}
                                  </div>
                                )}
                                {appointment.notes && (
                                  <div style={{
                                    fontSize: 9,
                                    color: "var(--text-muted)",
                                    opacity: 0.6,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 3,
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    width: "100%",
                                    fontStyle: "italic",
                                    lineHeight: 1,
                                  }}>
                                    <FileText size={8} style={{ flexShrink: 0 }} />
                                    {appointment.notes}
                                  </div>
                                )}
                              </>
                            )}
                          </>
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
                      (e.currentTarget as HTMLElement).style.background = "var(--accent-subtle, rgba(184,184,184,0.04))"
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = "transparent"
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
