// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Settings, Save, Clock, Users, CalendarDays, ChevronRight } from "lucide-react"
import { saveAgendaSettings, saveProfessionalHours } from "../actions/agenda.actions"
import type { AgendaSettingsRow, ProfessionalForAgenda, ProfessionalWorkingHoursRow } from "../types"
import { WEEKDAY_LABELS } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  settings: AgendaSettingsRow | null
  professionals: ProfessionalForAgenda[]
  workingHours: ProfessionalWorkingHoursRow[]
}

type TabKey = "general" | "professionals" | "schedule"

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "general", label: "Geral", icon: Settings },
  { key: "professionals", label: "Profissionais", icon: Users },
  { key: "schedule", label: "Jornada", icon: CalendarDays },
]

const SLOT_OPTIONS = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "60 minutos" },
]

const WEEKDAYS_ACTIVE = [1, 2, 3, 4, 5, 6] // Mon-Sat default

export default function AgendaSettingsDialog({
  open, onClose, onSaved, settings, professionals, workingHours,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("general")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // General settings form
  const [openingTime, setOpeningTime] = useState("07:00")
  const [closingTime, setClosingTime] = useState("21:00")
  const [slotInterval, setSlotInterval] = useState(30)
  const [allowOverbooking, setAllowOverbooking] = useState(false)

  // Professional working hours — map: profId -> weekday -> hours
  const [hoursMap, setHoursMap] = useState<Record<string, Record<number, {
    start_time: string; end_time: string; break_start_time: string; break_end_time: string; is_active: boolean
  }>>>({})

  const [selectedProfessional, setSelectedProfessional] = useState("")

  // Initialize from props
  useEffect(() => {
    if (!open) return

    if (settings) {
      setOpeningTime(settings.opening_time?.slice(0, 5) || "07:00")
      setClosingTime(settings.closing_time?.slice(0, 5) || "21:00")
      setSlotInterval(settings.slot_interval_minutes || 30)
      setAllowOverbooking(settings.allow_overbooking || false)
    }

    // Build hours map from existing data
    const map: typeof hoursMap = {}
    professionals.forEach(p => {
      map[p.id] = {}
      for (let w = 0; w <= 6; w++) {
        const existing = workingHours.find(h => h.professional_id === p.id && h.weekday === w)
        map[p.id][w] = {
          start_time: existing?.start_time?.slice(0, 5) || "09:00",
          end_time: existing?.end_time?.slice(0, 5) || "21:00",
          break_start_time: existing?.break_start_time?.slice(0, 5) || "",
          break_end_time: existing?.break_end_time?.slice(0, 5) || "",
          is_active: existing ? existing.is_active : (w >= 1 && w <= 6),
        }
      }
    })
    setHoursMap(map)

    if (professionals.length > 0 && !selectedProfessional) {
      setSelectedProfessional(professionals[0].id)
    }

    setError("")
    setSuccess("")
  }, [open, settings, professionals, workingHours])

  // Validate general settings
  const validateGeneral = (): string | null => {
    if (!openingTime || !closingTime) return "Horários são obrigatórios"
    if (closingTime <= openingTime) return "Fechamento deve ser maior que abertura"
    if (![15, 30, 60].includes(slotInterval)) return "Intervalo deve ser 15, 30 ou 60 minutos"
    return null
  }

  // Validate working hours for a professional
  const validateHours = (profId: string): string | null => {
    const profHours = hoursMap[profId]
    if (!profHours) return null

    for (let w = 0; w <= 6; w++) {
      const h = profHours[w]
      if (!h.is_active) continue

      if (!h.start_time || !h.end_time) {
        return `${WEEKDAY_LABELS[w]}: horários são obrigatórios`
      }
      if (h.end_time <= h.start_time) {
        return `${WEEKDAY_LABELS[w]}: fim deve ser maior que início`
      }
      if (h.break_start_time && h.break_end_time) {
        if (h.break_start_time < h.start_time || h.break_end_time > h.end_time) {
          return `${WEEKDAY_LABELS[w]}: pausa deve estar dentro da jornada`
        }
        if (h.break_end_time <= h.break_start_time) {
          return `${WEEKDAY_LABELS[w]}: fim da pausa deve ser maior que início`
        }
      }
    }
    return null
  }

  const handleSaveGeneral = async () => {
    const err = validateGeneral()
    if (err) { setError(err); return }

    setLoading(true)
    setError("")
    setSuccess("")

    const result = await saveAgendaSettings({
      opening_time: openingTime,
      closing_time: closingTime,
      slot_interval_minutes: slotInterval,
      allow_overbooking: allowOverbooking,
    })

    setLoading(false)

    if (result.success) {
      setSuccess("Configurações salvas com sucesso!")
      onSaved()
      setTimeout(() => setSuccess(""), 3000)
    } else {
      setError(result.error || "Erro ao salvar")
    }
  }

  const handleSaveHours = async (profId: string) => {
    const err = validateHours(profId)
    if (err) { setError(err); return }

    const profHours = hoursMap[profId]
    if (!profHours) return

    setLoading(true)
    setError("")
    setSuccess("")

    const hoursArray = Object.entries(profHours).map(([weekday, h]) => ({
      weekday: Number(weekday),
      start_time: h.start_time,
      end_time: h.end_time,
      break_start_time: h.break_start_time || null,
      break_end_time: h.break_end_time || null,
      is_active: h.is_active,
    }))

    const result = await saveProfessionalHours(profId, hoursArray)

    setLoading(false)

    if (result.success) {
      setSuccess("Jornada salva com sucesso!")
      onSaved()
      setTimeout(() => setSuccess(""), 3000)
    } else {
      setError(result.error || "Erro ao salvar jornada")
    }
  }

  const updateHour = (profId: string, weekday: number, field: string, value: any) => {
    setHoursMap(prev => ({
      ...prev,
      [profId]: {
        ...prev[profId],
        [weekday]: {
          ...prev[profId]?.[weekday],
          [field]: value,
        },
      },
    }))
  }

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color 150ms ease",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    marginBottom: 6,
    display: "block",
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 640,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Settings size={16} style={{ color: "var(--accent)" }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Configurações da Agenda
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "rgba(255,255,255,0.01)",
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(""); setSuccess("") }}
              style={{
                flex: 1,
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                color: activeTab === tab.key ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "inherit",
                transition: "all 150ms ease",
              }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {error && <div className="alert-banner danger" style={{ margin: "0 0 12px" }}>{error}</div>}
          {success && <div className="alert-banner success" style={{ margin: "0 0 12px" }}>{success}</div>}

          {/* ═══ Tab: General ═══ */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Abertura</label>
                  <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Fechamento</label>
                  <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Intervalo dos Slots</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {SLOT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSlotInterval(opt.value)}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        background: slotInterval === opt.value ? "var(--accent-subtle)" : "none",
                        border: `1px solid ${slotInterval === opt.value ? "var(--accent-border)" : "var(--border)"}`,
                        borderRadius: 8,
                        color: slotInterval === opt.value ? "var(--accent)" : "var(--text-secondary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "all 150ms ease",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Permitir Encaixe/Overbooking
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Permite agendar em horário já ocupado
                  </div>
                </div>
                <button
                  onClick={() => setAllowOverbooking(!allowOverbooking)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: allowOverbooking ? "var(--success)" : "var(--border-strong)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 200ms ease",
                  }}
                >
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 3,
                    left: allowOverbooking ? 23 : 3,
                    transition: "left 200ms ease",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }} />
                </button>
              </div>

              <div>
                <label style={labelStyle}>Timezone</label>
                <input
                  type="text"
                  value="America/Sao_Paulo"
                  disabled
                  style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
                />
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Timezone fixo para operação no Brasil
                </span>
              </div>

              <button
                onClick={handleSaveGeneral}
                disabled={loading}
                className="btn-primary"
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  marginTop: 4,
                }}
              >
                <Save size={14} />
                {loading ? "Salvando..." : "Salvar Configurações"}
              </button>
            </div>
          )}

          {/* ═══ Tab: Professionals ═══ */}
          {activeTab === "professionals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                Selecione um profissional para editar sua jornada na aba Jornada.
              </p>
              {professionals.map(prof => {
                const profHours = hoursMap[prof.id]
                const activeDays = profHours
                  ? Object.entries(profHours).filter(([, h]) => h.is_active).length
                  : 0

                return (
                  <button
                    key={prof.id}
                    onClick={() => { setSelectedProfessional(prof.id); setActiveTab("schedule") }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "all 150ms ease",
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--accent-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}>
                      {(prof.display_name || prof.name)[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {prof.display_name || prof.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {activeDays} dias ativos · {prof.name}
                      </div>
                    </div>
                    <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  </button>
                )
              })}
            </div>
          )}

          {/* ═══ Tab: Schedule (Jornada) ═══ */}
          {activeTab === "schedule" && selectedProfessional && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Professional selector */}
              <div>
                <label style={labelStyle}>Profissional</label>
                <select
                  value={selectedProfessional}
                  onChange={e => setSelectedProfessional(e.target.value)}
                  style={inputStyle}
                >
                  {professionals.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
                  ))}
                </select>
              </div>

              {/* Weekday rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[0, 1, 2, 3, 4, 5, 6].map(w => {
                  const h = hoursMap[selectedProfessional]?.[w]
                  if (!h) return null

                  return (
                    <div
                      key={w}
                      style={{
                        padding: "10px 14px",
                        background: h.is_active ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.005)",
                        border: `1px solid ${h.is_active ? "var(--border)" : "rgba(255,255,255,0.04)"}`,
                        borderRadius: 8,
                        opacity: h.is_active ? 1 : 0.5,
                        transition: "opacity 200ms ease",
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: h.is_active ? 8 : 0,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", minWidth: 70 }}>
                          {WEEKDAY_LABELS[w]}
                        </span>
                        <button
                          onClick={() => updateHour(selectedProfessional, w, "is_active", !h.is_active)}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 10,
                            border: "none",
                            background: h.is_active ? "var(--success)" : "var(--border-strong)",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background 200ms ease",
                          }}
                        >
                          <div style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#fff",
                            position: "absolute",
                            top: 3,
                            left: h.is_active ? 19 : 3,
                            transition: "left 200ms ease",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }} />
                        </button>
                      </div>

                      {h.is_active && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 8, marginBottom: 3 }}>Início</label>
                            <input
                              type="time"
                              value={h.start_time}
                              onChange={e => updateHour(selectedProfessional, w, "start_time", e.target.value)}
                              style={{ ...inputStyle, padding: "6px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 8, marginBottom: 3 }}>Fim</label>
                            <input
                              type="time"
                              value={h.end_time}
                              onChange={e => updateHour(selectedProfessional, w, "end_time", e.target.value)}
                              style={{ ...inputStyle, padding: "6px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 8, marginBottom: 3 }}>Pausa Início</label>
                            <input
                              type="time"
                              value={h.break_start_time}
                              onChange={e => updateHour(selectedProfessional, w, "break_start_time", e.target.value)}
                              style={{ ...inputStyle, padding: "6px 8px", fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: 8, marginBottom: 3 }}>Pausa Fim</label>
                            <input
                              type="time"
                              value={h.break_end_time}
                              onChange={e => updateHour(selectedProfessional, w, "break_end_time", e.target.value)}
                              style={{ ...inputStyle, padding: "6px 8px", fontSize: 11 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => handleSaveHours(selectedProfessional)}
                disabled={loading}
                className="btn-primary"
                style={{
                  padding: "11px 20px",
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: loading ? "wait" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  marginTop: 4,
                }}
              >
                <Save size={14} />
                {loading ? "Salvando..." : "Salvar Jornada"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
