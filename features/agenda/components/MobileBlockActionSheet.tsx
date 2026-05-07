"use client"

import { useState } from "react"
import { X, Lock, Unlock, AlertTriangle, Loader2, Calendar, Clock, User } from "lucide-react"
import { cancelBlock } from "../actions/agenda.actions"
import type { AppointmentBlockRow } from "../types"
import { BLOCK_TYPE_LABELS } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  block: AppointmentBlockRow | null
  onUnblocked: () => void
  hasPermission: boolean
  /** Optional: show professional name in the sheet */
  professionalName?: string
}

export default function MobileBlockActionSheet({
  open, onClose, block, onUnblocked, hasPermission, professionalName,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (!open || !block) return null

  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    } catch {
      return "--:--"
    }
  }

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso)
      const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
      const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
      return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
    } catch {
      return ""
    }
  }

  const handleUnblock = async () => {
    setLoading(true)
    setError("")
    const result = await cancelBlock(block.id)
    setLoading(false)
    if (result.success) {
      setConfirming(false)
      onUnblocked()
      onClose()
    } else {
      setError(result.error || "Não foi possível desbloquear este horário.")
    }
  }

  const handleClose = () => {
    setConfirming(false)
    setError("")
    onClose()
  }

  const blockTypeLabel = block.block_type ? BLOCK_TYPE_LABELS[block.block_type] || block.block_type : null

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
      onClick={(e) => e.target === e.currentTarget && handleClose()}
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

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(55,65,81,0.2)", border: "1px solid rgba(55,65,81,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lock size={13} style={{ color: "#9ca3af" }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Horário bloqueado
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: 6, borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Details Card */}
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          background: "rgba(55,65,81,0.08)",
          border: "1px solid rgba(55,65,81,0.2)",
          marginBottom: 16,
        }}>
          {/* Reason */}
          <div style={{
            fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10,
            lineHeight: 1.4,
          }}>
            {block.reason || "Sem motivo informado"}
          </div>

          {/* Meta grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Date */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {fmtDate(block.start_at)}
              </span>
            </div>

            {/* Time range */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {fmtTime(block.start_at)} — {fmtTime(block.end_at)}
              </span>
            </div>

            {/* Professional */}
            {professionalName && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {professionalName}
                </span>
              </div>
            )}
          </div>

          {/* Block type badge */}
          {blockTypeLabel && (
            <div style={{
              marginTop: 10, display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 9, fontWeight: 700, padding: "3px 10px",
              background: "rgba(107,114,128,0.12)", borderRadius: 5,
              color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em",
              border: "1px solid rgba(107,114,128,0.15)",
            }}>
              {blockTypeLabel}
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(55,65,81,0.06)",
          border: "1px solid rgba(55,65,81,0.12)",
          fontSize: 11, color: "var(--text-muted)",
          marginBottom: 16, textAlign: "center",
        }}>
          Este horário está indisponível na agenda.
        </div>

        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171", fontSize: 12, marginBottom: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hasPermission ? (
            confirming ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 14px", borderRadius: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  marginBottom: 4,
                }}>
                  <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24" }}>
                      Deseja desbloquear este horário?
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Após confirmar, ele voltará a ficar disponível para agendamentos.
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleUnblock}
                    disabled={loading}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: "14px 16px", borderRadius: 10,
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      color: "#34d399", fontSize: 13, fontWeight: 600,
                      cursor: loading ? "wait" : "pointer",
                      fontFamily: "inherit", opacity: loading ? 0.6 : 1,
                      minHeight: 48,
                    }}
                  >
                    {loading ? (
                      <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Unlock size={15} />
                    )}
                    {loading ? "Desbloqueando..." : "Sim, desbloquear"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "14px 16px", borderRadius: 10,
                      background: "none", border: "1px solid var(--border)",
                      color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                      minHeight: 48,
                    }}
                  >
                    Não
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 10,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  color: "#34d399", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", width: "100%",
                  textAlign: "left",
                  minHeight: 48,
                }}
              >
                <Unlock size={18} />
                Desbloquear horário
              </button>
            )
          ) : (
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              color: "#f87171", fontSize: 12, textAlign: "center",
              minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              Você não tem permissão para desbloquear este horário.
            </div>
          )}

          <button
            onClick={handleClose}
            style={{
              padding: "14px 16px", borderRadius: 10,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", width: "100%",
              marginTop: 4,
              minHeight: 48,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
