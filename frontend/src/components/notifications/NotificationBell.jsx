/**
 * NotificationBell Component — Shadcn UI
 * Bell icon with unread badge and dropdown.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationContext } from '../../context/NotificationContext';
import NotificationDropdown from './NotificationDropdown';
import { cn } from '@/lib/utils';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  } = useNotificationContext();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      refresh();
    }
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={cn(
          "relative p-2 rounded-md transition-colors",
          isOpen
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 text-[10px] font-bold text-white bg-destructive rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          notifications={notifications.slice(0, 5)}
          unreadCount={unreadCount}
          loading={loading}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onDelete={deleteNotification}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default NotificationBell;