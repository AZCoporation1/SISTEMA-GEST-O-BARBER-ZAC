"use client"

import { X, CalendarPlus, Lock } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  time: string
  date: string
  professionalName: string
  onAgendarClick: () => void
  onBloquearClick: () => void
}

export default function MobileSlotActionSheet({
  open, onClose, time, date, professionalName, onAgendarClick, onBloquearClick,
}: Props) {
  if (!open) return null

  const formatDate = (d: string) => {
    try {
      const obj = new Date(`${d}T12:00:00`)
      return `${obj.getDate().toString().padStart(2, "0")}/${(obj.getMonth() + 1).toString().padStart(2, "0")}`
    } catch {
      return d
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-surface)",
          borderRadius: "16px 16px 0 0",
          border: "1px solid var(--border)",
          borderBottom: "none",
          padding: "16px 16px 24px",
          animation: "slideUpSheet 200ms ease",
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "var(--border)", margin: "0 auto 14px",
        }} />

        {/* Title */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {time} · {formatDate(date)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {professionalName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => { onAgendarClick(); onClose() }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.2)",
              color: "#60a5fa", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", width: "100%",
              textAlign: "left",
            }}
          >
            <CalendarPlus size={18} />
            Agendar neste horário
          </button>

          <button
            onClick={() => { onBloquearClick(); onClose() }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(107,114,128,0.08)",
              border: "1px solid rgba(107,114,128,0.2)",
              color: "#9ca3af", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", width: "100%",
              textAlign: "left",
            }}
          >
            <Lock size={18} />
            Bloquear este horário
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "12px 16px", borderRadius: 10,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", width: "100%",
              marginTop: 4,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUpSheet {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
