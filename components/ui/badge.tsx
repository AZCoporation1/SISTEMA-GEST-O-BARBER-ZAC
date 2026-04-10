import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]",
        secondary:
          "border-transparent bg-[var(--bg-hover)] text-[var(--text-secondary)]",
        destructive:
          "border-[rgba(239,68,68,0.2)] bg-[var(--danger-bg)] text-[var(--danger)]",
        outline: "border-[var(--border-strong)] text-[var(--text-secondary)]",
        success:
          "border-[rgba(16,185,129,0.2)] bg-[var(--success-bg)] text-[var(--success)]",
        warning:
          "border-[rgba(245,158,11,0.2)] bg-[var(--warning-bg)] text-[var(--warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
