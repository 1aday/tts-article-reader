import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean
  success?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, ...props }, ref) => {
    const stateClasses = error
      ? "border-[--color-error] focus-visible:ring-[--color-error] focus-visible:border-[--color-error]"
      : success
      ? "border-[--color-success] focus-visible:ring-[--color-success] focus-visible:border-[--color-success]"
      : "border-[--border-color] focus-visible:ring-[--color-ring] focus-visible:border-[--color-ring]"

    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-xl border bg-surface-1/90 px-4 py-3 text-base text-white shadow-sm transition-all duration-200",
          "placeholder:text-white/40 resize-y",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-primary]",
          "focus-visible:shadow-[0_0_0_4px_rgba(255,111,69,0.2)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "hover:border-white/30",
          stateClasses,
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
