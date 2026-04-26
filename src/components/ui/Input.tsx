import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all shadow-inner hover:bg-white/10 focus:bg-white/10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
