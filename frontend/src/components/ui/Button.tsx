import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-smooth focus-ring disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-primary text-white shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0": variant === "default",
            "bg-destructive text-white shadow-button hover:shadow-button-hover hover:-translate-y-0.5 active:translate-y-0": variant === "destructive",
            "glass border border-white/20 hover:bg-white/90 hover:border-white/30 shadow-card hover:shadow-card-hover hover:-translate-y-0.5": variant === "outline",
            "glass-subtle hover:glass text-gray-900 shadow-minimal hover:shadow-card": variant === "secondary",
            "hover:glass-subtle": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
          },
          {
            "h-11 px-5 py-2.5": size === "default",
            "h-9 px-3.5 text-xs": size === "sm",
            "h-12 px-8 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
