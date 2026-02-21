import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-primary] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#e50914] to-[#b20710] text-white shadow-[0_12px_28px_rgba(229,9,20,0.35)] hover:shadow-[0_16px_34px_rgba(229,9,20,0.5)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90",
        outline:
          "border border-white/20 bg-white/5 text-white hover:border-white/35 hover:bg-white/10",
        secondary:
          "bg-[--surface-2] text-secondary-foreground border border-white/12 shadow-sm hover:bg-[--surface-3] hover:border-white/25",
        ghost: "text-white/75 hover:bg-white/10 hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
        terminal:
          "bg-transparent border border-[#e50914]/60 text-[#e50914] hover:bg-[#e50914]/10",
        success:
          "bg-[--color-success] text-black shadow-lg hover:bg-[--color-success]/90",
        warning:
          "bg-[--color-warning] text-black shadow-lg hover:bg-[--color-warning]/90",
        danger:
          "bg-[--color-error] text-white shadow-lg hover:bg-[--color-error]/90",
        cyan:
          "bg-[#e50914] text-white shadow-lg hover:bg-[#f40612]",
        purple:
          "bg-[#b20710] text-white shadow-lg hover:bg-[#c90a14]",
        gradient:
          "bg-gradient-to-r from-[#e50914] to-[#7e0a10] text-white shadow-lg hover:brightness-110",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-14 rounded-xl px-8 text-base",
        xl: "h-16 rounded-xl px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
