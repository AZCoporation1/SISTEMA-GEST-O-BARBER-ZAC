"use client"

import { useMemo } from "react"
import { Users, Eye } from "lucide-react"
import type { ProfessionalForAgenda } from "../types"

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface Props {
  professionals: ProfessionalForAgenda[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ProfessionalViewSelector({
  professionals,
  selectedIds,
  onSelectionChange,
}: Props) {
  const total = professionals.length
  const allSelected = selectedIds.length === total && total > 0

  // ── Preset helpers ──
  const presets = useMemo(() => {
    const items: { label: string; count: number }[] = []
    for (let i = 1; i <= Math.min(total, 3); i++) {
      items.push({ label: String(i), count: i })
    }
    if (total > 1) {
      items.push({ label: "Todos", count: total })
    }
    return items
  }, [total])

  const activePreset = useMemo(() => {
    if (allSelected) return total
    return selectedIds.length
  }, [selectedIds.length, allSelected, total])

  const handlePreset = (count: number) => {
    if (count >= total) {
      // Select all
      onSelectionChange(professionals.map(p => p.id))
    } else {
      // Keep the first N of currently selected, or default to first N
      const current = professionals.filter(p => selectedIds.includes(p.id))
      if (current.length >= count) {
        onSelectionChange(current.slice(0, count).map(p => p.id))
      } else {
        onSelectionChange(professionals.slice(0, count).map(p => p.id))
      }
    }
  }

  // ── Chip toggle ──
  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      // Don't allow empty selection
      if (selectedIds.length <= 1) return
      onSelectionChange(selectedIds.filter(sid => sid !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  if (total <= 1) return null

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 5,
      marginBottom: 8,
      padding: "7px 12px",
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      {/* Row 1: Presets + Label */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          flexShrink: 0,
          userSelect: "none",
        }}>
          <Eye size={12} style={{ opacity: 0.7 }} />
          Colunas:
        </div>

        {/* Preset buttons */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "var(--bg-elevated, rgba(128,128,128,0.06))",
          borderRadius: 8,
          padding: 3,
        }}>
          {presets.map(p => {
            const isActive = p.count === activePreset ||
              (p.count === total && allSelected)
            return (
              <button
                key={p.label}
                onClick={() => handlePreset(p.count)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: p.label === "Todos" ? "4px 12px" : "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: isActive
                    ? "var(--accent)"
                    : "transparent",
                  color: isActive
                    ? "#0a0a0f"
                    : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 150ms ease",
                  minWidth: p.label === "Todos" ? undefined : 28,
                }}
              >
                {p.label === "Todos" && <Users size={11} />}
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Count indicator */}
        <span style={{
          fontSize: 10,
          color: "var(--text-muted)",
          fontWeight: 500,
          marginLeft: "auto",
          flexShrink: 0,
        }}>
          {allSelected
            ? `${total} profissionais`
            : `${selectedIds.length} de ${total}`}
        </span>
      </div>

      {/* Row 2: Individual professional chips */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 2,
      }}>
        {professionals.map(prof => {
          const isActive = selectedIds.includes(prof.id)
          const initial = (prof.display_name || prof.name).charAt(0).toUpperCase()
          const displayName = prof.display_name || prof.name

          return (
            <button
              key={prof.id}
              onClick={() => handleToggle(prof.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px 5px 6px",
                borderRadius: 100,
                border: isActive
                  ? "1.5px solid var(--accent)"
                  : "1.5px solid var(--border)",
                background: isActive
                  ? "var(--accent-subtle)"
                  : "transparent",
                color: isActive
                  ? "var(--accent)"
                  : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 600,
                cursor: selectedIds.length <= 1 && isActive ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
                opacity: isActive ? 1 : 0.7,
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: isActive
                  ? "var(--accent)"
                  : "var(--bg-elevated, rgba(128,128,128,0.1))",
                color: isActive
                  ? "#0a0a0f"
                  : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 800,
                flexShrink: 0,
                transition: "all 150ms ease",
              }}>
                {initial}
              </div>
              {displayName}
            </button>
          )
        })}
      </div>
    </div>
  )
}
