"use client"

import { Card } from "./card"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label: string
    isPositive?: boolean
  }
  className?: string
}

export function KPICard({
  title,
  value,
  description,
  icon,
  trend,
  className,
}: KPICardProps) {
  return (
    <Card className={cn("kpi-card", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="kpi-label">{title}</p>
          <p className="kpi-value">{value}</p>
          {(description || trend) && (
            <p className={cn(
              "kpi-delta", 
              trend?.isPositive === true ? "positive" : trend?.isPositive === false ? "negative" : "neutral",
              "mt-2"
            )}>
              {trend && `${trend.value > 0 && trend.isPositive !== false ? "+" : ""}${trend.value}% `}
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div className="kpi-icon">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
