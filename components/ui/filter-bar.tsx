"use client"

import { Input } from "./input"
import { Search } from "lucide-react"

interface FilterBarProps {
  onSearchChange?: (value: string) => void
  searchValue?: string
  placeholder?: string
  children?: React.ReactNode
}

export function FilterBar({
  onSearchChange,
  searchValue,
  placeholder = "Buscar...",
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
      <div className="flex flex-1 items-center gap-2 w-full max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
