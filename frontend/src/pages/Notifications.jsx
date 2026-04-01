/**
 * Notifications Page
 * ==================
 * Full page view of all notifications.
 * Uses NotificationContext for shared state.
 */

import { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';
import NotificationItem from '../components/notifications/NotificationItem';
import { showSuccess, showError } from '../utils/toast';

const Notifications = () => {
  const [filter, setFilter] = useState('all');

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
    refresh,
    fetchNotifications,
  } = useNotificationContext();

  // Fetch more notifications when page loads
  useEffect(() => {
    fetchNotifications(50);
  }, [fetchNotifications]);

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      showSuccess('All notifications marked as read');
    } else {
      showError('Failed to mark notifications as read');
    }
  };

  const handleClearRead = async () => {
    if (window.confirm('Are you sure you want to delete all read notifications?')) {
      const success = await clearRead();
      if (success) {
        showSuccess('Read notifications cleared');
      } else {
        showError('Failed to clear notifications');
      }
    }
  };

  const handleRefresh = () => {
    fetchNotifications(50);
    showSuccess('Notifications refreshed');
  };

  const handleDelete = async (id) => {
    const success = await deleteNotification(id);
    if (success) {
      showSuccess('Notification deleted');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="text-primary-600" />
              Notifications
            </h1>
            <p className="text-gray-500 mt-1">
              {notifications.length} total, {unreadCount} unread
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {['all', 'unread', 'read'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : 'Read'}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <CheckCheck size={18} />
                Mark All as Read
              </button>
            )}
            
            {notifications.some((n) => n.is_read) && (
              <button
                onClick={handleClearRead}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
                Clear Read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Loader2 size={32} className="animate-spin text-gray-400 mx-auto" />
            <p className="text-gray-500 mt-2">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Bell size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {filter === 'all' 
                ? 'No notifications yet' 
                : filter === 'unread'
                  ? 'No unread notifications'
                  : 'No read notifications'
              }
            </h3>
            <p className="text-gray-500">
              {filter === 'unread' ? "You're all caught up!" : "Notifications will appear here."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={handleDelete}
              compact={false}
              showActions={true}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;