"use client"

import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

export function KPICard({ title, value, description, icon, className }: KPICardProps) {
  return (
    <div className={cn("kpi-card", className)}>
      <div className="kpi-header">
        <span className="kpi-label">{title}</span>
        {icon && <div className="kpi-icon">{icon}</div>}
      </div>
      <div className="kpi-value">{value}</div>
      {description && (
        <p className="text-xs font-medium text-[var(--text-secondary)] leading-snug">{description}</p>
      )}
    </div>
  )
}
