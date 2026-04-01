/**
 * VM Health Badge Component
 * =========================
 * Displays VM health status with color-coded badge
 */

import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

const VMHealthBadge = ({ status, lastChecked, showLabel = true, size = 'default' }) => {
  // Format last checked time
  const formatLastChecked = (dateString) => {
    if (!dateString) return 'Never checked';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Get status configuration
  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          icon: CheckCircle,
          label: 'Healthy',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          dotColor: 'bg-green-500',
          borderColor: 'border-green-200',
        };
      case 'unreachable':
        return {
          icon: XCircle,
          label: 'Unreachable',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          dotColor: 'bg-red-500',
          borderColor: 'border-red-200',
        };
      case 'unknown':
      default:
        return {
          icon: HelpCircle,
          label: 'Unknown',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
          dotColor: 'bg-gray-400',
          borderColor: 'border-gray-200',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Size variants
  const sizeClasses = {
    small: 'px-1.5 py-0.5 text-xs',
    default: 'px-2 py-1 text-xs',
    large: 'px-3 py-1.5 text-sm',
  };

  const iconSizes = {
    small: 12,
    default: 14,
    large: 16,
  };

  return (
    <div className="flex flex-col gap-0.5">
      {/* Status Badge */}
      <span
        className={`
          inline-flex items-center gap-1 rounded-full font-medium
          ${config.bgColor} ${config.textColor} ${config.borderColor}
          ${sizeClasses[size]}
          border
        `}
      >
        <Icon size={iconSizes[size]} />
        {showLabel && config.label}
      </span>

      {/* Last Checked Time */}
      {lastChecked !== undefined && (
        <span className="text-xs text-gray-400">
          {formatLastChecked(lastChecked)}
        </span>
      )}
    </div>
  );
};

export default VMHealthBadge;