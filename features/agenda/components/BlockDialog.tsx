"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { createBlock } from "../actions/agenda.actions"
import { BLOCK_TYPE_LABELS } from "../types"
import type { ProfessionalForAgenda } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  professionals: ProfessionalForAgenda[]
  defaultDate: string
  defaultProfessionalId?: string
}

export default function BlockDialog({
  open, onClose, onSaved, professionals, defaultDate, defaultProfessionalId,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId || "")
  const [startDate, setStartDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState("12:00")
  const [endDate, setEndDate] = useState(defaultDate)
  const [endTime, setEndTime] = useState("13:00")
  const [blockType, setBlockType] = useState<string>("manual")
  const [reason, setReason] = useState("")

  const handleSubmit = async () => {
    if (!professionalId || !reason.trim()) { setError("Profissional e motivo são obrigatórios"); return }

    setLoading(true)
    setError("")

    const result = await createBlock({
      professional_id: professionalId,
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      block_type: blockType as any,
      reason,
    })

    setLoading(false)
    if (result.success) {
      onSaved()
      onClose()
    } else {
      setError(result.error || "Erro ao criar bloqueio")
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
        maxWidth: 440,
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Bloquear Horário</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div className="alert-banner danger" style={{ margin: 0 }}>{error}</div>}

          <div>
            <label style={labelStyle}>Profissional</label>
            <select value={professionalId} onChange={e => setProfessionalId(e.target.value)} style={inputStyle}>
              <option value="">Selecione...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.display_name || p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Tipo</label>
            <select value={blockType} onChange={e => setBlockType(e.target.value)} style={inputStyle}>
              {Object.entries(BLOCK_TYPE_LABELS).filter(([k]) => k !== "recurring").map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Início</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setEndDate(e.target.value) }} style={inputStyle} />
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </div>
            <div>
              <label style={labelStyle}>Fim</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Motivo</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Almoço, reunião, indisponível..." style={inputStyle} />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{ padding: "9px 20px", borderRadius: 8, fontSize: 12, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "inherit" }}>
            {loading ? "Salvando..." : "Bloquear"}
          </button>
        </div>
      </div>
    </div>
  )
}
