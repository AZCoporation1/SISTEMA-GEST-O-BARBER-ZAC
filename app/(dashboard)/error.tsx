"use client"

import { useEffect, useState } from "react"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error)
  }, [error])

  const safeMessage = error?.message || "Erro desconhecido"
  const safeDigest = error?.digest || null

  const technicalInfo = [
    `Erro: ${safeMessage}`,
    safeDigest ? `Digest: ${safeDigest}` : null,
    `Rota: (dashboard)`,
    `Hora: ${new Date().toISOString()}`,
  ].filter(Boolean).join("\n")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(technicalInfo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
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
          Ocorreu um erro inesperado
        </h2>

        <p style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          marginBottom: 20,
          lineHeight: 1.5,
        }}>
          A página encontrou um problema. Tente novamente ou volte ao painel.
        </p>

        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.15)",
          borderRadius: 8,
          padding: "12px 14px",
          textAlign: "left",
          marginBottom: 16,
          maxHeight: 100,
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

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopy}
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
            }}
          >
            {copied ? "✓ Copiado!" : "📋 Copiar erro"}
          </button>

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
            ← Painel
          </button>
        </div>
      </div>
    </div>
  )
}
