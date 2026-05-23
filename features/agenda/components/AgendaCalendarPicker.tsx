"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Props {
  selectedDate: string
  onDateChange: (date: string) => void
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]
const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default function AgendaCalendarPicker({ selectedDate, onDateChange }: Props) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate + "T12:00:00")
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay()

  const prevMonth = () => {
    setViewMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setViewMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const getDayStr = (day: number) => {
    const m = String(viewMonth.month + 1).padStart(2, "0")
    const d = String(day).padStart(2, "0")
    return `${viewMonth.year}-${m}-${d}`
  }

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: 12,
      width: "100%",
    }}>
      {/* Month Navigation */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <button
          onClick={prevMonth}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
        }}>
          {MONTHS_PT[viewMonth.month]} {viewMonth.year}
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
        marginBottom: 4,
      }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{
            textAlign: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            padding: "4px 0",
          }}>
            {w}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
      }}>
        {/* Empty cells for days before 1st */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayStr = getDayStr(day)
          const isToday = dayStr === todayStr
          const isSelected = dayStr === selectedDate
          const isSunday = new Date(viewMonth.year, viewMonth.month, day).getDay() === 0

          return (
            <button
              key={day}
              onClick={() => onDateChange(dayStr)}
              style={{
                width: "100%",
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: isSelected || isToday ? 700 : 500,
                color: isSelected
                  ? "#0a0a0f"
                  : isToday
                    ? "var(--accent)"
                    : isSunday
                      ? "var(--text-muted)"
                      : "var(--text-primary)",
                background: isSelected
                  ? "var(--accent)"
                  : isToday
                    ? "var(--accent-subtle)"
                    : "transparent",
                border: isToday && !isSelected
                  ? "1px solid var(--accent-border)"
                  : "1px solid transparent",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          onDateChange(todayStr)
          setViewMonth({ year: today.getFullYear(), month: today.getMonth() })
        }}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "8px 0",
          background: "var(--accent-subtle)",
          border: "1px solid var(--accent-border)",
          borderRadius: 8,
          color: "var(--accent)",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
      >
        Hoje
      </button>
    </div>
  )
}
