import { cn } from "@/lib/utils"

const statusConfig = {
  online: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Online" },
  healthy: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Healthy" },
  offline: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", label: "Offline" },
  unreachable: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", label: "Unreachable" },
  warning: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Warning" },
  expiring: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Expiring" },
  expired: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", label: "Expired" },
  valid: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Valid" },
  active: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Active" },
  disabled: { dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-100", label: "Disabled" },
  pending: { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", label: "Pending" },
  unknown: { dot: "bg-gray-400", text: "text-gray-600", bg: "bg-gray-100", label: "Unknown" },
}

export function StatusBadge({ status, label, className, showDot = true }) {
  const config = statusConfig[status] || statusConfig.unknown
  const displayLabel = label || config.label

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      )}
      {displayLabel}
    </span>
  )
}

export default StatusBadge
