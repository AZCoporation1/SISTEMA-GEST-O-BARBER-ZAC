// @ts-nocheck
"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Repeat, Search, Calendar, AlertTriangle, Check, Clock } from "lucide-react"
import { createRecurringAppointments } from "../actions/agenda.actions"
import { searchCustomers } from "../services/agenda.service"
import type { ProfessionalForAgenda } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  professionals: ProfessionalForAgenda[]
  services: Array<{ id: string; name: string; price: number; duration_minutes: number }>
  defaultDate: string
  defaultProfessionalId?: string
}

type RecurrenceType = "weekly" | "biweekly" | "monthly"

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export default function RecurrenceDialog({
  open, onClose, onSaved, professionals, services, defaultDate, defaultProfessionalId,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [notes, setNotes] = useState("")
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("weekly")
  const [recurrenceCount, setRecurrenceCount] = useState(4)

  // Result
  const [result, setResult] = useState<{
    created: string[]
    conflicts: string[]
    errors: string[]
    total: number
  } | null>(null)

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Init
  useEffect(() => {
    if (!open) return
    setCustomerName("")
    setCustomerPhone("")
    setCustomerId(null)
    setProfessionalId(defaultProfessionalId || "")
    setServiceId("")
    setDate(defaultDate)
    setTime("09:00")
    setDurationMinutes(30)
    setNotes("")
    setRecurrenceType("weekly")
    setRecurrenceCount(4)
    setError("")
    setResult(null)
    setCustomerSearch("")
  }, [open, defaultDate, defaultProfessionalId])

  // Service → duration
  useEffect(() => {
    if (!serviceId) return
    const svc = services.find(s => s.id === serviceId)
    if (svc) setDurationMinutes(svc.duration_minutes)
  }, [serviceId, services])

  // Customer search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setCustomerResults([]); return }
    const results = await searchCustomers(q)
    setCustomerResults(results)
    setShowCustomerDropdown(true)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(customerSearch), 300)
    return () => clearTimeout(t)
  }, [customerSearch, doSearch])

  const selectCustomer = (c: any) => {
    setCustomerId(c.id)
    setCustomerName(c.full_name)
    setCustomerPhone(c.phone || c.mobile_phone || "")
    setShowCustomerDropdown(false)
    setCustomerSearch("")
  }

  // Preview dates
  const previewDates = (() => {
    if (!date) return []
    const dates: string[] = []
    try {
      const baseDate = new Date(`${date}T12:00:00`)
      if (isNaN(baseDate.getTime())) return []
      const intervalDays = recurrenceType === "weekly" ? 7 : recurrenceType === "biweekly" ? 14 : 0

      for (let i = 0; i < recurrenceCount; i++) {
        const d = new Date(baseDate)
        if (recurrenceType === "monthly") {
          d.setMonth(d.getMonth() + i)
        } else {
          d.setDate(d.getDate() + (intervalDays * i))
        }
        dates.push(d.toISOString().split("T")[0])
      }
    } catch {
      return []
    }
    return dates
  })()

  const handleSubmit = async () => {
    if (!customerName.trim()) { setError("Nome do cliente é obrigatório"); return }
    if (!professionalId) { setError("Selecione um profissional"); return }
    if (!date || !time) { setError("Data e hora são obrigatórios"); return }
    if (recurrenceCount < 1 || recurrenceCount > 12) { setError("Quantidade deve ser entre 1 e 12"); return }

    setLoading(true)
    setError("")
    setResult(null)

    const res = await createRecurringAppointments(
      {
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        professional_id: professionalId,
        service_id: serviceId || null,
        start_date: date,
        start_time: time,
        duration_minutes: durationMinutes,
        notes: notes || null,
        status: "scheduled",
        source: "admin",
      },
      {
        type: recurrenceType,
        count: recurrenceCount,
      }
    )

    setLoading(false)

    if (res.success && res.data) {
      setResult(res.data)
      onSaved()
    } else {
      setError(res.error || "Erro ao criar recorrência")
    }
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
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16,
        width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Repeat size={16} style={{ color: "var(--info)" }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
              Agendamento Recorrente
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div className="alert-banner danger" style={{ margin: 0 }}>{error}</div>}

          {/* If we have a result, show it */}
          {result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Summary */}
              <div style={{
                padding: 14, background: "var(--success-bg)", border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
              }}>
                <Check size={16} style={{ color: "var(--success)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>
                  {result.created.length} de {result.total} agendamentos criados
                </span>
              </div>

              {/* Created dates */}
              {result.created.length > 0 && (
                <div>
                  <div style={{ ...labelStyle, color: "var(--success)" }}>✓ Criados</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {result.created.map(d => (
                      <span key={d} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: "var(--success-bg)", color: "var(--success)",
                        border: "1px solid rgba(16,185,129,0.2)",
                      }}>
                        {d.split("-").reverse().join("/")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflicts */}
              {result.conflicts.length > 0 && (
                <div>
                  <div style={{ ...labelStyle, color: "var(--warning)" }}>
                    <AlertTriangle size={10} style={{ marginRight: 4 }} />
                    Conflitos ({result.conflicts.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {result.conflicts.map((c, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderRadius: 6, fontSize: 11,
                        background: "var(--warning-bg)", color: "var(--warning)",
                        border: "1px solid rgba(245,158,11,0.15)",
                      }}>
                        {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div>
                  <div style={{ ...labelStyle, color: "var(--danger)" }}>Erros</div>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{
                      padding: "6px 10px", borderRadius: 6, fontSize: 11,
                      background: "var(--danger-bg)", color: "var(--danger)",
                    }}>
                      {e}
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} className="btn-primary" style={{
                padding: "11px 20px", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>
                Fechar
              </button>
            </div>
          ) : (
            <>
              {/* Customer */}
              <div>
                <label style={labelStyle}>Cliente</label>
                <div style={{ position: "relative" }}>
                  <input
                    value={customerId ? customerName : customerSearch || customerName}
                    onChange={e => {
                      if (customerId) { setCustomerId(null) }
                      setCustomerSearch(e.target.value)
                      setCustomerName(e.target.value)
                    }}
                    placeholder="Buscar ou digitar nome..."
                    style={inputStyle}
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0,
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: 6, marginTop: 2, zIndex: 20, maxHeight: 140, overflowY: "auto",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                    }}>
                      {customerResults.map(c => (
                        <button key={c.id} onClick={() => selectCustomer(c)} style={{
                          width: "100%", padding: "6px 10px", background: "none", border: "none",
                          borderBottom: "1px solid var(--border)", color: "var(--text-primary)",
                          fontSize: 11, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        }}>
                          {c.full_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Professional + Service */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Profissional</label>
                  <select value={professionalId} onChange={e => setProfessionalId(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {professionals.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Serviço</label>
                  <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inputStyle}>
                    <option value="">Selecione...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Date + Time + Duration */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Data Inicial</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hora</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Duração</label>
                  <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} style={inputStyle}>
                    {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m}min</option>)}
                  </select>
                </div>
              </div>

              {/* Recurrence config */}
              <div style={{
                padding: 14, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)",
                borderRadius: 10,
              }}>
                <div style={{ ...labelStyle, color: "var(--info)", marginBottom: 10 }}>
                  <Repeat size={10} style={{ marginRight: 4 }} /> Recorrência
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>Tipo</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["weekly", "biweekly", "monthly"] as RecurrenceType[]).map(t => (
                        <button
                          key={t}
                          onClick={() => setRecurrenceType(t)}
                          style={{
                            flex: 1,
                            padding: "7px 4px",
                            background: recurrenceType === t ? "rgba(59,130,246,0.15)" : "none",
                            border: `1px solid ${recurrenceType === t ? "rgba(59,130,246,0.3)" : "var(--border)"}`,
                            borderRadius: 6,
                            color: recurrenceType === t ? "#60a5fa" : "var(--text-secondary)",
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {RECURRENCE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9, marginBottom: 4 }}>Ocorrências (máx 12)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={recurrenceCount}
                      onChange={e => setRecurrenceCount(Math.min(12, Math.max(1, Number(e.target.value))))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {date && (
                <div>
                  <div style={{ ...labelStyle, fontSize: 9 }}>
                    <Calendar size={9} style={{ marginRight: 4 }} />
                    Datas Previstas ({previewDates.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {previewDates.map((d, i) => {
                      const obj = new Date(`${d}T12:00:00`)
                      return (
                        <span key={d} style={{
                          padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                          background: "rgba(59,130,246,0.08)", color: "#60a5fa",
                          border: "1px solid rgba(59,130,246,0.15)",
                        }}>
                          {WEEKDAY_NAMES[obj.getDay()]} {d.split("-").reverse().join("/")}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary"
                style={{
                  padding: "11px 20px", borderRadius: 10, fontSize: 13,
                  cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  fontFamily: "inherit", marginTop: 4,
                }}
              >
                <Repeat size={14} />
                {loading ? "Criando..." : `Criar ${recurrenceCount} Agendamentos`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
