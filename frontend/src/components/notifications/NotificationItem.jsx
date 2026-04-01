/**
 * NotificationItem Component
 * ==========================
 * Single notification card with actions.
 * Updated: Added styling for admin notification types
 */

import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Bell,
  Server,
  KeyRound,
  X,
  Check,
  Shield,
  UserPlus,
  Activity,
} from 'lucide-react';

const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  showActions = true,
  compact = false,
}) => {
  // Get icon and color based on notification type
  const getNotificationStyle = (type) => {
    switch (type) {
      // ==========================================
      // USER NOTIFICATIONS
      // ==========================================
      case 'password_reset_success':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50',
          iconColor: 'text-green-500',
          borderColor: 'border-green-200',
        };
      case 'password_reset_failed':
        return {
          icon: XCircle,
          bgColor: 'bg-red-50',
          iconColor: 'text-red-500',
          borderColor: 'border-red-200',
        };
      case 'password_expiry_warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-50',
          iconColor: 'text-yellow-500',
          borderColor: 'border-yellow-200',
        };
      case 'vm_unreachable':
        return {
          icon: Server,
          bgColor: 'bg-orange-50',
          iconColor: 'text-orange-500',
          borderColor: 'border-orange-200',
        };
      case 'vm_health_restored':
        return {
          icon: Server,
          bgColor: 'bg-green-50',
          iconColor: 'text-green-500',
          borderColor: 'border-green-200',
        };
      case 'welcome':
        return {
          icon: Bell,
          bgColor: 'bg-blue-50',
          iconColor: 'text-blue-500',
          borderColor: 'border-blue-200',
        };
      case 'system_alert':
        return {
          icon: Info,
          bgColor: 'bg-purple-50',
          iconColor: 'text-purple-500',
          borderColor: 'border-purple-200',
        };

      // ==========================================
      // ADMIN NOTIFICATIONS (NEW!)
      // ==========================================
      case 'admin_password_alert':
        return {
          icon: Shield,
          bgColor: 'bg-indigo-50',
          iconColor: 'text-indigo-500',
          borderColor: 'border-indigo-200',
        };
      case 'admin_user_signup':
        return {
          icon: UserPlus,
          bgColor: 'bg-cyan-50',
          iconColor: 'text-cyan-500',
          borderColor: 'border-cyan-200',
        };
      case 'admin_vm_alert':
        return {
          icon: Server,
          bgColor: 'bg-amber-50',
          iconColor: 'text-amber-500',
          borderColor: 'border-amber-200',
        };
      case 'admin_security_alert':
        return {
          icon: Shield,
          bgColor: 'bg-red-50',
          iconColor: 'text-red-500',
          borderColor: 'border-red-200',
        };
      case 'vm_status_change':
        return {
          icon: Activity,
          bgColor: 'bg-teal-50',
          iconColor: 'text-teal-500',
          borderColor: 'border-teal-200',
        };
      
      // ==========================================
      // DEFAULT
      // ==========================================
      default:
        return {
          icon: Bell,
          bgColor: 'bg-gray-50',
          iconColor: 'text-gray-500',
          borderColor: 'border-gray-200',
        };
    }
  };

  const style = getNotificationStyle(notification.type);
  const Icon = style.icon;

  const handleMarkAsRead = (e) => {
    e.stopPropagation();
    if (onMarkAsRead && !notification.is_read) {
      onMarkAsRead(notification.id);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  // Check if this is an admin notification
  const isAdminNotification = notification.type?.startsWith('admin_');

  if (compact) {
    // Compact version for dropdown
    return (
      <div
        className={`
          p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors
          ${!notification.is_read ? style.bgColor : ''}
        `}
        onClick={handleMarkAsRead}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`p-2 rounded-full ${style.bgColor}`}>
            <Icon size={16} className={style.iconColor} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium text-gray-900 truncate ${
                !notification.is_read ? 'font-semibold' : ''
              }`}>
                {notification.title}
              </p>
              {!notification.is_read && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isAdminNotification ? 'bg-indigo-500' : 'bg-blue-500'
                }`} />
              )}
              {isAdminNotification && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {notification.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {notification.time_ago || 'Just now'}
            </p>
          </div>

          {/* Actions */}
          {showActions && (
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full version for notifications page
  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${!notification.is_read
          ? `${style.bgColor} ${style.borderColor}`
          : 'bg-white border-gray-200'
        }
        hover:shadow-sm
      `}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-3 rounded-full ${style.bgColor}`}>
          <Icon size={20} className={style.iconColor} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-medium text-gray-900 ${
              !notification.is_read ? 'font-semibold' : ''
            }`}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                isAdminNotification 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                New
              </span>
            )}
            {isAdminNotification && (
              <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                Admin Alert
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {notification.message}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {notification.time_ago || 'Just now'}
          </p>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2">
            {!notification.is_read && (
              <button
                onClick={handleMarkAsRead}
                className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                title="Mark as read"
              >
                <Check size={18} />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationItem;