"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-xs font-semibold text-[var(--text-secondary)] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 select-none uppercase tracking-wide",
        className
      )}
      {...props}
    />
  )
}

export { Label }
