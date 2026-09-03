import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/Skeleton"

export function StatCard({ title, value, icon: Icon, iconColor = "text-primary", iconBg = "bg-primary/10", loading = false, subtitle, className }) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  )
}

export default StatCard
