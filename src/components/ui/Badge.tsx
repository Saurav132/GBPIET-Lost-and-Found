import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors border",
      {
        "border-transparent bg-primary text-primary-foreground shadow-[0_0_10px_rgba(6,182,212,0.4)]": variant === 'default',
        "border-transparent bg-white/10 text-white backdrop-blur-md": variant === 'secondary',
        "border-transparent bg-destructive text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]": variant === 'destructive',
        "border-transparent bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-success border-success": variant === 'success',
        "border-white/20 text-gray-300 backdrop-blur-sm": variant === 'outline',
      },
      className
    )} {...props} />
  )
}

export { Badge }
