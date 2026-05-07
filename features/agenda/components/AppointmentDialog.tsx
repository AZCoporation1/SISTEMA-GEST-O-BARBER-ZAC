"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Search, User, Clock, FileText } from "lucide-react"
import { createAppointment, updateAppointment } from "../actions/agenda.actions"
import { searchCustomers } from "../services/agenda.service"
import type { ProfessionalForAgenda, AppointmentWithRelations } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  professionals: ProfessionalForAgenda[]
  services: Array<{ id: string; name: string; price: number; duration_minutes: number }>
  defaultDate: string
  defaultTime?: string
  defaultProfessionalId?: string
  editingAppointment?: AppointmentWithRelations | null
}

export default function AppointmentDialog({
  open,
  onClose,
  onSaved,
  professionals,
  services,
  defaultDate,
  defaultTime,
  defaultProfessionalId,
  editingAppointment,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [notes, setNotes] = useState("")

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [clientMode, setClientMode] = useState<"cadastrado" | "avulso">("cadastrado")

  // Initialize form
  useEffect(() => {
    if (!open) return
    if (editingAppointment) {
      setCustomerName(editingAppointment.customer_name_snapshot || "")
      setCustomerPhone(editingAppointment.customer_phone_snapshot || "")
      setCustomerId(editingAppointment.customer_id)
      setClientMode(editingAppointment.customer_id ? "cadastrado" : "avulso")
      setProfessionalId(editingAppointment.professional_id)
      setServiceId(editingAppointment.service_id || "")
      setDate(editingAppointment.start_at.split("T")[0])
      const startTime = new Date(editingAppointment.start_at)
      setTime(`${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`)
      setDurationMinutes(editingAppointment.service_duration_minutes_snapshot || 30)
      setNotes(editingAppointment.notes || "")
    } else {
      setCustomerName("")
      setCustomerPhone("")
      setCustomerId(null)
      setClientMode("cadastrado")
      setProfessionalId(defaultProfessionalId || "")
      setServiceId("")
      setDate(defaultDate)
      setTime(defaultTime || "09:00")
      setDurationMinutes(30)
      setNotes("")
    }
    setError("")
    setCustomerSearch("")
    setCustomerResults([])
  }, [open, editingAppointment, defaultDate, defaultTime, defaultProfessionalId])

  // Service change → update duration
  useEffect(() => {
    if (!serviceId) return
    const svc = services.find(s => s.id === serviceId)
    if (svc) setDurationMinutes(svc.duration_minutes)
  }, [serviceId, services])

  // Customer search debounce
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

  const handleSubmit = async () => {
    if (clientMode === "cadastrado" && !customerId) {
      setError("Selecione um cliente cadastrado na lista.")
      return
    }
    if (clientMode === "avulso" && !customerName.trim()) {
      setError("Nome do cliente avulso é obrigatório.")
      return
    }
    if (!professionalId) { setError("Selecione um profissional"); return }
    if (!date || !time) { setError("Data e hora são obrigatórios"); return }

    setLoading(true)
    setError("")

    const payload = {
      customer_id: clientMode === "cadastrado" ? customerId : null,
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
    }

    const result = editingAppointment
      ? await updateAppointment(editingAppointment.id, payload)
      : await createAppointment(payload)

    setLoading(false)

    if (result.success) {
      onSaved()
      onClose()
    } else {
      setError(result.error || "Erro desconhecido")
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
    transition: "border-color 150ms ease",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
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
        maxWidth: 520,
        maxHeight: "90dvh",
        overflowY: "auto",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            {editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}
          </h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div className="alert-banner danger" style={{ margin: 0 }}>
              {error}
            </div>
          )}

          {/* Customer */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}><User size={10} style={{ marginRight: 4 }} />Cliente</label>
              
              <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 2, borderRadius: 6, border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode("cadastrado")
                    if (!customerId) {
                      setCustomerName("")
                      setCustomerSearch("")
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: "none",
                    background: clientMode === "cadastrado" ? "var(--bg-surface)" : "transparent",
                    color: clientMode === "cadastrado" ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: clientMode === "cadastrado" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer"
                  }}
                >
                  Cadastrado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode("avulso")
                    if (customerId) {
                      setCustomerId(null)
                      setCustomerName("")
                      setCustomerSearch("")
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: "none",
                    background: clientMode === "avulso" ? "var(--bg-surface)" : "transparent",
                    color: clientMode === "avulso" ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: clientMode === "avulso" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                    cursor: "pointer"
                  }}
                >
                  Avulso
                </button>
              </div>
            </div>

            {clientMode === "cadastrado" ? (
              <div style={{ position: "relative" }}>
                <input
                  value={customerId ? customerName : customerSearch}
                  onChange={e => {
                    if (customerId) {
                      setCustomerId(null)
                      setCustomerName("")
                    }
                    setCustomerSearch(e.target.value)
                  }}
                  placeholder="Buscar nome ou telefone do cliente..."
                  style={{...inputStyle, borderColor: (customerId ? "var(--border-accent, var(--border))" : "var(--border)")}}
                />
                {!customerId && customerSearch.length > 0 && customerSearch.length < 2 && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                    Digite pelo menos 2 caracteres...
                  </div>
                )}
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginTop: 4,
                    zIndex: 20,
                    maxHeight: 200,
                    overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}>
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          color: "var(--text-primary)",
                          fontSize: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{c.full_name}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{c.phone || c.mobile_phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {customerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId(null)
                      setCustomerName("")
                      setCustomerSearch("")
                      setCustomerPhone("")
                    }}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 10,
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer"
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Nome do cliente avulso..."
                style={inputStyle}
              />
            )}

            <input
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="Telefone (opcional)"
              style={{ ...inputStyle, marginTop: 6 }}
              disabled={clientMode === "cadastrado" && !!customerId} // Prevent editing phone if mapped from DB
            />
          </div>

          {/* Professional */}
          <div>
            <label style={labelStyle}>Profissional</label>
            <select
              value={professionalId}
              onChange={e => setProfessionalId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Selecione...</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.display_name || p.name}</option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label style={labelStyle}>Serviço</label>
            <select
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Selecione o serviço...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — R$ {s.price.toFixed(2)} ({s.duration_minutes}min)
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}><Clock size={10} style={{ marginRight: 4 }} />Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Duração</label>
              <select
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                style={inputStyle}
              >
                {[15, 30, 45, 60, 90, 120].map(m => (
                  <option key={m} value={m}>{m}min</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}><FileText size={10} style={{ marginRight: 4 }} />Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observações opcionais..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 16px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary"
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              fontSize: 12,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontFamily: "inherit",
            }}
          >
            {loading ? "Salvando..." : editingAppointment ? "Salvar" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  )
}
