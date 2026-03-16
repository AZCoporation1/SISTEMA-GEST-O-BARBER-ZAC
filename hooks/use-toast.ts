// Shim: wraps sonner's toast to match the shadcn toast API used throughout the feature hooks.
// This allows the feature modules to call useToast() the same way while using sonner under the hood.
import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  function toast(options: ToastOptions) {
    const message = options.title || ""
    const description = options.description

    if (options.variant === "destructive") {
      sonnerToast.error(message, { description })
    } else {
      sonnerToast.success(message, { description })
    }
  }

  return { toast }
}
