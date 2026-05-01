// @ts-nocheck
"use client"

import { useState, useMemo } from "react"
import { Plus, Lock, Clock, User, Users, Phone, ChevronLeft, ChevronRight, CalendarPlus, Scissors, List } from "lucide-react"
import type { AppointmentWithRelations, AppointmentBlockRow, ProfessionalForAgenda, ProfessionalWorkingHoursRow, AgendaSettingsRow } from "../types"
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_COLORS } from "../types"
import MobileSlotActionSheet from "./MobileSlotActionSheet"
import MobileBlockActionSheet from "./MobileBlockActionSheet"

interface Props {
  date: string
  appointments: AppointmentWithRelations[]
  blocks: AppointmentBlockRow[]
  professionals: ProfessionalForAgenda[]
  workingHours: ProfessionalWorkingHoursRow[]
  settings: AgendaSettingsRow | null
  onSlotClick: (time: string, professionalId: string) => void
  onAppointmentClick: (appointment: AppointmentWithRelations) => void
  onBlockUnblocked: () => void
  onDateChange: (date: string) => void
  onNewAppointment: () => void
  onNewBlock: () => void
  onOpenWaitlist: () => void
  restrictToProfessionalId?: string | null
  hasAdminAccess: boolean
  isProfessional: boolean
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

export default function AgendaMobileView({
  date, appointments, blocks, professionals, workingHours, settings,
  onSlotClick, onAppointmentClick, onBlockUnblocked, onDateChange,
  onNewAppointment, onNewBlock, onOpenWaitlist,
  restrictToProfessionalId, hasAdminAccess, isProfessional,
}: Props) {
  const visibleProfessionals = useMemo(() => {
    if (restrictToProfessionalId) return professionals.filter(p => p.id === restrictToProfessionalId)
    return professionals
  }, [professionals, restrictToProfessionalId])

  const [selectedProfIdx, setSelectedProfIdx] = useState(0)
  const selectedProf = visibleProfessionals[selectedProfIdx] || visibleProfessionals[0]

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false)

  // Slot action sheet
  const [slotSheet, setSlotSheet] = useState<{ open: boolean; time: string } | null>(null)

  // Block action sheet
  const [blockSheet, setBlockSheet] = useState<{ open: boolean; block: AppointmentBlockRow | null }>({ open: false, block: null })

  // ── Weekly calendar strip ──
  const dateObj = new Date(`${date}T12:00:00`)
  const weekStart = useMemo(() => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() - d.getDay()) // Sunday
    return d
  }, [date])

  const weekDays = useMemo(() => {
    const days: { label: string; dateStr: string; dayNum: number; isToday: boolean; isSelected: boolean }[] = []
    const today = new Date().toISOString().split("T")[0]
    const labels = ["D", "S", "T", "Q", "Q", "S", "S"]
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().split("T")[0]
      days.push({ label: labels[i], dateStr: ds, dayNum: d.getDate(), isToday: ds === today, isSelected: ds === date })
    }
    return days
  }, [weekStart, date])

  const monthLabel = useMemo(() => {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    return `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`
  }, [date])

  const prevWeek = () => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() - 7)
    onDateChange(d.toISOString().split("T")[0])
  }
  const nextWeek = () => {
    const d = new Date(`${date}T12:00:00`)
    d.setDate(d.getDate() + 7)
    onDateChange(d.toISOString().split("T")[0])
  }
  const goToday = () => onDateChange(new Date().toISOString().split("T")[0])

  // ── Timeline slots ──
  const slotInterval = settings?.slot_interval_minutes || 30
  const openTime = settings?.opening_time || "07:00"
  const closeTime = settings?.closing_time || "21:00"
  const currentDayOfWeek = dateObj.getDay()

  const todayHours = useMemo(() => {
    if (!selectedProf) return null
    return workingHours.find(h => h.professional_id === selectedProf.id && h.weekday === currentDayOfWeek && h.is_active) || null
  }, [workingHours, selectedProf, currentDayOfWeek])

  const timeSlots = useMemo(() => {
    const openMin = timeToMin(openTime)
    const closeMin = timeToMin(closeTime)
    const slots: string[] = []
    for (let m = openMin; m < closeMin; m += slotInterval) slots.push(minToTime(m))
    return slots
  }, [openTime, closeTime, slotInterval])

  // ── Helpers ──
  const isWithinWorkingHours = (time: string) => {
    if (!todayHours) return false
    const t = timeToMin(time)
    const s = timeToMin(todayHours.start_time)
    const e = timeToMin(todayHours.end_time)
    if (t < s || t >= e) return false
    if (todayHours.break_start_time && todayHours.break_end_time) {
      const bs = timeToMin(todayHours.break_start_time)
      const be = timeToMin(todayHours.break_end_time)
      if (t >= bs && t < be) return false
    }
    return true
  }

  const getBlockAtSlot = (time: string): AppointmentBlockRow | null => {
    if (!selectedProf) return null
    const slotStart = new Date(`${date}T${time}:00-03:00`).getTime()
    const slotEnd = slotStart + slotInterval * 60000
    return (blocks ?? []).find(b => {
      if (b.professional_id !== selectedProf.id || !b.is_active) return false
      return new Date(b.start_at).getTime() < slotEnd && new Date(b.end_at).getTime() > slotStart
    }) || null
  }

  const getApptAtSlot = (time: string): AppointmentWithRelations | null => {
    if (!selectedProf) return null
    const slotStart = new Date(`${date}T${time}:00-03:00`).getTime()
    const slotEnd = slotStart + slotInterval * 60000
    return (appointments ?? []).filter(a => a.professional_id === selectedProf.id && !["cancelled"].includes(a.status))
      .find(a => new Date(a.start_at).getTime() < slotEnd && new Date(a.end_at).getTime() > slotStart) || null
  }

  const isFirstSlot = (appt: AppointmentWithRelations, time: string) => {
    const slotStart = new Date(`${date}T${time}:00-03:00`).getTime()
    const aStart = new Date(appt.start_at).getTime()
    return Math.abs(aStart - slotStart) < slotInterval * 60000 && slotStart <= aStart
  }

  const getSpan = (appt: AppointmentWithRelations) => Math.max(1, Math.ceil((appt.service_duration_minutes_snapshot || 30) / slotInterval))

  const fmtTime = (iso: string) => {
    try { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }
    catch { return "--:--" }
  }

  const SLOT_H = 52

  // ── No-linkage state ──
  if (isProfessional && !restrictToProfessionalId) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <Users size={32} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Vínculo não encontrado</div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>Seu usuário ainda não está vinculado a um profissional.<br />Fale com o administrador.</div>
      </div>
    )
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: "calc(100vh - 160px)" }}>

      {/* ═══ Weekly Calendar Strip ═══ */}
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "12px 12px 0 0", padding: "10px 12px 8px",
      }}>
        {/* Month + nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={prevWeek} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{monthLabel}</span>
            {date !== new Date().toISOString().split("T")[0] && (
              <button onClick={goToday} style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                background: "var(--accent-subtle)", border: "1px solid var(--accent-border)",
                color: "var(--accent)", cursor: "pointer", fontFamily: "inherit",
              }}>HOJE</button>
            )}
          </div>
          <button onClick={nextWeek} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4 }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Week days */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {weekDays.map(wd => (
            <button
              key={wd.dateStr}
              onClick={() => onDateChange(wd.dateStr)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "6px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                background: wd.isSelected ? "var(--accent)" : wd.isToday ? "var(--accent-subtle)" : "transparent",
                border: wd.isToday && !wd.isSelected ? "1px solid var(--accent-border)" : "1px solid transparent",
                color: wd.isSelected ? "#0a0a0f" : wd.isToday ? "var(--accent)" : "var(--text-secondary)",
                transition: "all 120ms ease",
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em" }}>{wd.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{wd.dayNum}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Professional Tabs ═══ */}
      <div style={{
        display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto",
        WebkitOverflowScrolling: "touch", background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
      }}>
        {visibleProfessionals.map((prof, idx) => (
          <button
            key={prof.id}
            onClick={() => setSelectedProfIdx(idx)}
            style={{
              flex: 1, minWidth: 0, padding: "10px 8px", background: "none", border: "none",
              borderBottom: selectedProfIdx === idx ? "2px solid var(--accent)" : "2px solid transparent",
              color: selectedProfIdx === idx ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              fontFamily: "inherit", transition: "all 150ms ease", whiteSpace: "nowrap",
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: selectedProfIdx === idx ? "var(--accent-subtle)" : "rgba(255,255,255,0.04)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              color: selectedProfIdx === idx ? "var(--accent)" : "var(--text-muted)",
            }}>
              {(prof.display_name || prof.name)[0]}
            </div>
            <span style={{ fontSize: 10 }}>{prof.display_name || prof.name}</span>
          </button>
        ))}
      </div>

      {/* ═══ Timeline ═══ */}
      <div style={{
        flex: 1, background: "var(--bg-surface)", overflowY: "auto",
        borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)", borderRadius: "0 0 12px 12px",
      }}>
        {!todayHours ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            <div style={{ fontSize: 14, marginBottom: 4, fontWeight: 600, color: "var(--text-secondary)" }}>Folga</div>
            <div>{selectedProf?.display_name || selectedProf?.name} não trabalha neste dia</div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {timeSlots.map((time) => {
              const within = isWithinWorkingHours(time)
              const block = within ? getBlockAtSlot(time) : null
              const appt = within && !block ? getApptAtSlot(time) : null
              const first = appt ? isFirstSlot(appt, time) : false
              const span = appt && first ? getSpan(appt) : 1
              const colors = appt ? APPOINTMENT_STATUS_COLORS[appt.status] || APPOINTMENT_STATUS_COLORS.scheduled : null

              return (
                <div key={time} style={{
                  display: "flex", height: SLOT_H,
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: !within ? "rgba(255,255,255,0.015)" : "transparent",
                }}>
                  {/* Time label */}
                  <div style={{
                    width: 48, minWidth: 48, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {time}
                  </div>

                  {/* Slot content */}
                  <div style={{ flex: 1, position: "relative", padding: "2px 6px" }}>
                    {!within ? (
                      <div style={{ height: "100%", opacity: 0.3 }} />
                    ) : block ? (
                      <button
                        onClick={() => setBlockSheet({ open: true, block })}
                        style={{
                          width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 8,
                          padding: "0 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                          background: "rgba(55,65,81,0.12)", border: "1px solid rgba(55,65,81,0.25)",
                          textAlign: "left",
                        }}
                      >
                        <Lock size={11} style={{ color: "#6b7280", flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>
                          {block.reason || "Bloqueado"}
                        </span>
                      </button>
                    ) : appt && first ? (
                      <button
                        onClick={() => onAppointmentClick(appt)}
                        style={{
                          position: "absolute", top: 2, left: 6, right: 6,
                          height: span * SLOT_H - 4, zIndex: 5,
                          display: "flex", flexDirection: "column", justifyContent: "center",
                          padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                          background: colors?.bg, border: `1px solid ${colors?.border}`,
                          fontFamily: "inherit", textAlign: "left", overflow: "hidden",
                          transition: "transform 100ms ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: colors?.text }}>
                            {fmtTime(appt.start_at)} — {fmtTime(appt.end_at)}
                          </span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                            background: "rgba(0,0,0,0.25)", color: colors?.text,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>
                            {APPOINTMENT_STATUS_LABELS[appt.status]}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {appt.customer_name_snapshot || "Walk-in"}
                        </div>
                        {appt.service_name_snapshot && (
                          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1, display: "flex", alignItems: "center", gap: 3 }}>
                            <Scissors size={8} /> {appt.service_name_snapshot}
                          </div>
                        )}
                      </button>
                    ) : appt && !first ? null : (
                      <button
                        onClick={() => {
                          if (selectedProf) setSlotSheet({ open: true, time })
                        }}
                        style={{
                          width: "100%", height: "100%", background: "transparent",
                          border: "1px dashed rgba(255,255,255,0.04)", borderRadius: 6,
                          cursor: "pointer", transition: "background 100ms ease",
                        }}
                        onTouchStart={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(184,184,184,0.06)" }}
                        onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ FAB ═══ */}
      {selectedProf && (
        <>
          {fabOpen && (
            <div
              style={{ position: "fixed", inset: 0, zIndex: 88 }}
              onClick={() => setFabOpen(false)}
            />
          )}
          {fabOpen && (
            <div style={{
              position: "fixed", bottom: 84, right: 24, zIndex: 89,
              display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end",
              animation: "fadeInUp 150ms ease",
            }}>
              <button onClick={() => { setFabOpen(false); onNewAppointment() }} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "#60a5fa", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}>
                <CalendarPlus size={15} /> Novo agendamento
              </button>
              <button onClick={() => { setFabOpen(false); onNewBlock() }} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "#9ca3af", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}>
                <Lock size={15} /> Bloquear horário
              </button>
              <button onClick={() => { setFabOpen(false); onOpenWaitlist() }} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                color: "#fbbf24", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}>
                <List size={15} /> Lista de espera
              </button>
            </div>
          )}
          <button
            onClick={() => setFabOpen(!fabOpen)}
            style={{
              position: "fixed", bottom: 24, right: 24,
              width: 52, height: 52, borderRadius: "50%",
              background: fabOpen ? "rgba(239,68,68,0.9)" : "var(--gradient-brand-subtle)",
              border: `1px solid ${fabOpen ? "rgba(239,68,68,0.4)" : "var(--accent-border)"}`,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 90,
              transition: "all 200ms ease",
              transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
            }}
          >
            <Plus size={22} />
          </button>
        </>
      )}

      {/* ═══ Action Sheets ═══ */}
      <MobileSlotActionSheet
        open={!!slotSheet?.open}
        onClose={() => setSlotSheet(null)}
        time={slotSheet?.time || ""}
        date={date}
        professionalName={selectedProf?.display_name || selectedProf?.name || ""}
        onAgendarClick={() => {
          if (selectedProf && slotSheet) onSlotClick(slotSheet.time, selectedProf.id)
        }}
        onBloquearClick={() => {
          if (selectedProf && slotSheet) {
            onSlotClick(slotSheet.time, selectedProf.id)
            onNewBlock()
          }
        }}
      />

      <MobileBlockActionSheet
        open={blockSheet.open}
        onClose={() => setBlockSheet({ open: false, block: null })}
        block={blockSheet.block}
        onUnblocked={onBlockUnblocked}
        hasPermission={hasAdminAccess || (!!restrictToProfessionalId && blockSheet.block?.professional_id === restrictToProfessionalId)}
      />

      <style jsx global>{`
        @keyframes fadeInUp {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
