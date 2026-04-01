/**
 * Alert Component
 */

import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

const variants = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: CheckCircle,
    iconColor: 'text-green-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: AlertCircle,
    iconColor: 'text-yellow-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

const Alert = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const styles = variants[variant];
  const Icon = styles.icon;

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} ${styles.text}
        border rounded-lg p-4
        ${className}
      `}
    >
      <div className="flex">
        <Icon className={`h-5 w-5 ${styles.iconColor} flex-shrink-0`} />
        <div className="ml-3 flex-1">
          {title && <h4 className="font-medium">{title}</h4>}
          <div className={title ? 'mt-1 text-sm' : 'text-sm'}>{children}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-3 ${styles.iconColor} hover:opacity-70`}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;