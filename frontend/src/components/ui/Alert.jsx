import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react"

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>div]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800 [&>svg]:text-emerald-600",
        warning: "border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600",
        error: "border-red-200 bg-red-50 text-red-800 [&>svg]:text-red-600",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  destructive: AlertCircle,
}

const Alert = React.forwardRef(
  ({ className, variant = "default", children, onClose, ...props }, ref) => {
    const Icon = iconMap[variant]
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon className="h-4 w-4" />
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-0.5 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
export default Alert