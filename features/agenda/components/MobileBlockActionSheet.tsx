"use client"

import { useState } from "react"
import { X, Lock, Unlock, AlertTriangle } from "lucide-react"
import { cancelBlock } from "../actions/agenda.actions"
import type { AppointmentBlockRow } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  block: AppointmentBlockRow | null
  onUnblocked: () => void
  hasPermission: boolean
}

export default function MobileBlockActionSheet({
  open, onClose, block, onUnblocked, hasPermission,
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
      setError(result.error || "Erro ao desbloquear")
    }
  }

  const handleClose = () => {
    setConfirming(false)
    setError("")
    onClose()
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
            <Lock size={16} style={{ color: "#9ca3af" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Bloqueio
            </span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Details */}
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "rgba(55,65,81,0.1)",
          border: "1px solid rgba(55,65,81,0.25)",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            {block.reason || "Sem motivo informado"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {fmtTime(block.start_at)} — {fmtTime(block.end_at)}
          </div>
          {block.block_type && (
            <div style={{
              marginTop: 6, fontSize: 9, fontWeight: 700, padding: "2px 8px",
              background: "rgba(107,114,128,0.15)", borderRadius: 4,
              display: "inline-block", color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {block.block_type}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171", fontSize: 12, marginBottom: 12,
          }}>
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
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  marginBottom: 4,
                }}>
                  <AlertTriangle size={14} style={{ color: "#fbbf24", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#fbbf24" }}>
                    Confirma o desbloqueio deste horário?
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleUnblock}
                    disabled={loading}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 8, padding: "12px 16px", borderRadius: 10,
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.25)",
                      color: "#34d399", fontSize: 13, fontWeight: 600,
                      cursor: loading ? "wait" : "pointer",
                      fontFamily: "inherit", opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <Unlock size={15} />
                    {loading ? "Desbloqueando..." : "Sim, desbloquear"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    style={{
                      flex: 1, padding: "12px 16px", borderRadius: 10,
                      background: "none", border: "1px solid var(--border)",
                      color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
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
                }}
              >
                <Unlock size={18} />
                Desbloquear horário
              </button>
            )
          ) : (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              color: "#f87171", fontSize: 12, textAlign: "center",
            }}>
              Você não tem permissão para desbloquear este horário.
            </div>
          )}

          <button
            onClick={handleClose}
            style={{
              padding: "12px 16px", borderRadius: 10,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", width: "100%",
              marginTop: 4,
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
