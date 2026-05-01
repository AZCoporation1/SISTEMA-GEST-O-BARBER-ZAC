// @ts-nocheck
"use client"

import { useState, useMemo } from "react"
import { Plus, Lock, Clock, User, Users, Phone, ChevronDown, CalendarDays, Scissors } from "lucide-react"
import type { AppointmentWithRelations, AppointmentBlockRow, ProfessionalForAgenda, ProfessionalWorkingHoursRow } from "../types"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from "../types"

interface Props {
  date: string
  appointments: AppointmentWithRelations[]
  blocks: AppointmentBlockRow[]
  professionals: ProfessionalForAgenda[]
  workingHours: ProfessionalWorkingHoursRow[]
  onSlotClick: (time: string, professionalId: string) => void
  onAppointmentClick: (appointment: AppointmentWithRelations) => void
  onBlockClick?: (block: AppointmentBlockRow) => void
  /** If set, filter to single professional (for `professional` role) */
  restrictToProfessionalId?: string | null
}

export default function AgendaMobileView({
  date, appointments, blocks, professionals, workingHours,
  onSlotClick, onAppointmentClick, onBlockClick, restrictToProfessionalId,
}: Props) {
  // Filter professionals based on role restriction
  const visibleProfessionals = useMemo(() => {
    if (restrictToProfessionalId) {
      return professionals.filter(p => p.id === restrictToProfessionalId)
    }
    return professionals
  }, [professionals, restrictToProfessionalId])

  const [selectedProfIdx, setSelectedProfIdx] = useState(0)
  const selectedProf = visibleProfessionals[selectedProfIdx] || visibleProfessionals[0]

  // Current date info
  const currentDayOfWeek = new Date(`${date}T12:00:00`).getDay()

  // Get appointments for selected professional
  const profAppointments = useMemo(() => {
    if (!selectedProf) return []
    return appointments
      .filter(a => a.professional_id === selectedProf.id)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  }, [appointments, selectedProf])

  // Get blocks for selected professional
  const profBlocks = useMemo(() => {
    if (!selectedProf) return []
    return blocks.filter(b => b.professional_id === selectedProf.id && b.is_active)
  }, [blocks, selectedProf])

  // Get working hours for today
  const todayHours = useMemo(() => {
    if (!selectedProf) return null
    return workingHours.find(
      h => h.professional_id === selectedProf.id && h.weekday === currentDayOfWeek && h.is_active
    )
  }, [workingHours, selectedProf, currentDayOfWeek])

  // Count totals
  const totalActive = profAppointments.filter(a => !['cancelled', 'no_show'].includes(a.status)).length
  const totalCompleted = profAppointments.filter(a => a.status === 'completed').length

  // Format time
  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // Format date for header
  const formatDate = (d: string) => {
    const obj = new Date(`${d}T12:00:00`)
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return `${weekdays[obj.getDay()]}, ${obj.getDate().toString().padStart(2, '0')}/${(obj.getMonth() + 1).toString().padStart(2, '0')}`
  }

  if (visibleProfessionals.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <Users size={28} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
        <div style={{ fontSize: 13 }}>Nenhum profissional disponível</div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: "calc(100vh - 200px)" }}>
      {/* ═══ Professional Tabs ═══ */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        background: "var(--bg-surface)",
        borderRadius: "10px 10px 0 0",
        border: "1px solid var(--border)",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      }}>
        {visibleProfessionals.map((prof, idx) => (
          <button
            key={prof.id}
            onClick={() => setSelectedProfIdx(idx)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "12px 10px",
              background: "none",
              border: "none",
              borderBottom: selectedProfIdx === idx
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              color: selectedProfIdx === idx ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              fontFamily: "inherit",
              transition: "all 150ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: selectedProfIdx === idx ? "var(--accent-subtle)" : "rgba(255,255,255,0.04)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: selectedProfIdx === idx ? "var(--accent)" : "var(--text-muted)",
            }}>
              {(prof.display_name || prof.name)[0]}
            </div>
            <span style={{ fontSize: 10 }}>{prof.display_name || prof.name}</span>
          </button>
        ))}
      </div>

      {/* ═══ Day Info Bar ═══ */}
      <div style={{
        padding: "10px 14px",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
            {formatDate(date)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--text-muted)" }}>
          {todayHours && (
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />
              {todayHours.start_time.slice(0, 5)} – {todayHours.end_time.slice(0, 5)}
            </span>
          )}
          <span>{totalActive} ativos</span>
          <span>{totalCompleted} finalizados</span>
        </div>
      </div>

      {/* ═══ Appointments List ═══ */}
      <div style={{
        flex: 1,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderRadius: "0 0 10px 10px",
        padding: "8px 10px",
        overflowY: "auto",
      }}>
        {/* Blocks */}
        {profBlocks.map(block => (
          <div
            key={block.id}
            onClick={() => onBlockClick?.(block)}
            style={{
              padding: "10px 12px",
              background: "rgba(55,65,81,0.15)",
              border: "1px solid rgba(55,65,81,0.3)",
              borderRadius: 8,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <Lock size={13} style={{ color: "#9ca3af", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>
                BLOQUEIO · {block.reason || "Sem motivo"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                {fmtTime(block.start_at)} — {fmtTime(block.end_at)}
              </div>
            </div>
          </div>
        ))}

        {/* Appointments */}
        {profAppointments.length === 0 && profBlocks.length === 0 ? (
          <div style={{
            padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 12,
          }}>
            {!todayHours ? (
              <>
                <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 600, color: "var(--text-secondary)" }}>Folga</div>
                <div>{selectedProf?.display_name || selectedProf?.name} não trabalha neste dia</div>
              </>
            ) : (
              <>
                <CalendarDays size={28} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                <div>Nenhum agendamento</div>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {profAppointments.map(appt => {
              const colors = APPOINTMENT_STATUS_COLORS[appt.status]
              const isCancelled = appt.status === 'cancelled' || appt.status === 'no_show'

              return (
                <button
                  key={appt.id}
                  onClick={() => onAppointmentClick(appt)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    opacity: isCancelled ? 0.5 : 1,
                    transition: "transform 100ms ease",
                  }}
                >
                  {/* Time + Status */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}>
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <Clock size={11} style={{ color: colors.text }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                        {fmtTime(appt.start_at)} — {fmtTime(appt.end_at)}
                      </span>
                    </div>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      background: "rgba(0,0,0,0.3)",
                      color: colors.text,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>
                      {APPOINTMENT_STATUS_LABELS[appt.status]}
                    </span>
                  </div>

                  {/* Client */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <User size={11} style={{ color: "var(--text-secondary)" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {appt.customer_name_snapshot || "Walk-in"}
                    </span>
                    {appt.customer_phone_snapshot && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                        <Phone size={9} style={{ marginRight: 2 }} />
                        {appt.customer_phone_snapshot}
                      </span>
                    )}
                  </div>

                  {/* Service + Price */}
                  {appt.service_name_snapshot && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Scissors size={9} />
                        {appt.service_name_snapshot}
                      </span>
                      {appt.service_price_snapshot && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                          R$ {Number(appt.service_price_snapshot).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ FAB - New Appointment ═══ */}
      {selectedProf && todayHours && (
        <button
          onClick={() => onSlotClick(
            `${String(new Date().getHours()).padStart(2, '0')}:${String(Math.floor(new Date().getMinutes() / 30) * 30).padStart(2, '0')}`,
            selectedProf.id,
          )}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--gradient-brand-subtle)",
            border: "1px solid var(--accent-border)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            zIndex: 90,
            transition: "transform 150ms ease, box-shadow 150ms ease",
          }}
          title="Novo Agendamento"
        >
          <Plus size={22} />
        </button>
      )}
    </div>
  )
}
