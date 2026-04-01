/**
 * Notification Context
 * ====================
 * Provides notification state and refresh function globally.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Fetch notifications
  const fetchNotifications = useCallback(async (limit = 10) => {
    if (!isAuthenticated || !isMountedRef.current) return;

    try {
      setLoading(true);
      const data = await notificationAPI.getAll({ limit });
      
      if (isMountedRef.current) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  // Fetch only unread count (lightweight)
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !isMountedRef.current) return;

    try {
      const data = await notificationAPI.getUnreadCount();
      if (isMountedRef.current) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [isAuthenticated]);

  // Refresh notifications - call this after actions like password reset
  const refresh = useCallback(() => {
    console.log('🔔 Refreshing notifications...');
    fetchNotifications(10);
  }, [fetchNotifications]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      console.error('Failed to mark as read:', err);
      return false;
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      return false;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const wasUnread = notifications.find(n => n.id === notificationId && !n.is_read);
      await notificationAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return true;
    } catch (err) {
      console.error('Failed to delete notification:', err);
      return false;
    }
  }, [notifications]);

  // Clear all read
  const clearRead = useCallback(async () => {
    try {
      await notificationAPI.clearRead();
      setNotifications(prev => prev.filter(n => !n.is_read));
      return true;
    } catch (err) {
      console.error('Failed to clear read:', err);
      return false;
    }
  }, []);

  // Initial fetch when authenticated
  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated) {
      fetchNotifications(10);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isAuthenticated, fetchNotifications]);

  // Polling for new notifications (every 60 seconds)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (isAuthenticated) {
      intervalRef.current = setInterval(() => {
        fetchUnreadCount();
      }, 60000); // 60 seconds
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, fetchUnreadCount]);

  const value = {
    notifications,
    unreadCount,
    loading,
    refresh, // ← Call this after password reset!
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

export default NotificationContext;