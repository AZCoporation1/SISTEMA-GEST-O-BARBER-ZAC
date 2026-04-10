import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-h-[80px] rounded-lg border px-3 py-2 text-sm transition-all duration-150 outline-none resize-y",
        "bg-[var(--bg-elevated)] border-[var(--border-strong)] text-[var(--text-primary)]",
        "placeholder:text-[var(--text-muted)]",
        "focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
