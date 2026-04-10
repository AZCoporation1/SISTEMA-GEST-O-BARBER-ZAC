import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border px-3 py-1.5 text-sm transition-all duration-150 outline-none",
        "bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]",
        "placeholder:text-[var(--text-muted)] placeholder:font-normal",
        "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
