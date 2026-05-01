"use client"

import { useEffect, useState } from "react"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AgendaError({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false)
  const [savedError, setSavedError] = useState<string | null>(null)

  useEffect(() => {
    // Log to console with full stack
    console.error("[Agenda Error Boundary]", error)
    console.error("[Agenda Stack]", error?.stack)

    // Save to localStorage for post-mortem
    try {
      const payload = JSON.stringify({
        message: error?.message || "Unknown error",
        digest: error?.digest || null,
        stack: error?.stack?.split("\n").slice(0, 8).join("\n") || null,
        route: "/agendamento",
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      })
      localStorage.setItem("barberzac_agenda_last_error", payload)
    } catch {
      // localStorage not available
    }
  }, [error])

  // Load saved error from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("barberzac_agenda_last_error")
      if (saved) setSavedError(saved)
    } catch {
      // ignore
    }
  }, [])

  const safeMessage = error?.message || "Erro desconhecido"
  const safeDigest = error?.digest || null
  const safeStack = error?.stack
    ?.split("\n")
    .slice(0, 5)
    .map((line: string) => line.replace(/https?:\/\/[^\s]+/g, "[url]"))
    .join("\n") || null

  const technicalInfo = [
    `Erro: ${safeMessage}`,
    safeDigest ? `Digest: ${safeDigest}` : null,
    `Rota: /agendamento`,
    `Hora: ${new Date().toISOString()}`,
    safeStack ? `\nStack:\n${safeStack}` : null,
  ].filter(Boolean).join("\n")

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement("textarea")
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="page-content" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 32,
        textAlign: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 24,
        }}>
          ⚠️
        </div>

        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 8,
        }}>
          Não foi possível carregar a Agenda
        </h2>

        <p style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 20,
          lineHeight: 1.5,
        }}>
          Ocorreu um erro inesperado ao renderizar a página de agendamentos.
          Copie o erro técnico abaixo e envie ao suporte.
        </p>

        {/* Error message */}
        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 8,
          padding: "12px 14px",
          textAlign: "left",
          marginBottom: 16,
          maxHeight: 120,
          overflowY: "auto",
        }}>
          <code style={{
            fontSize: 11,
            color: "#f87171",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {safeMessage}
            {safeDigest && `\nDigest: ${safeDigest}`}
          </code>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => handleCopy(technicalInfo)}
            style={{
              padding: "10px 16px",
              background: copied ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)",
              border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)"}`,
              borderRadius: 8,
              color: copied ? "#34d399" : "#60a5fa",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 150ms ease",
            }}
          >
            {copied ? "✓ Copiado!" : "📋 Copiar erro técnico"}
          </button>

          {savedError && (
            <button
              onClick={() => handleCopy(savedError)}
              style={{
                padding: "8px 16px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              📦 Copiar último erro salvo (localStorage)
            </button>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={reset}
              className="btn-primary"
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              🔄 Tentar novamente
            </button>

            <button
              onClick={() => window.location.href = "/dashboard"}
              style={{
                flex: 1,
                padding: "10px 16px",
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
              ← Voltar ao painel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
