/**
 * Notification Context
 * ====================
 * Provides notification state and refresh function globally.
 * Supports server-side pagination (50 per page).
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const PAGE_SIZE = 50;

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Fetch notifications with pagination
  const fetchNotifications = useCallback(async (page = 1) => {
    if (!isAuthenticated || !isMountedRef.current) return;

    try {
      setLoading(true);
      const offset = (page - 1) * PAGE_SIZE;
      const data = await notificationAPI.getAll({ limit: PAGE_SIZE, offset });
      
      if (isMountedRef.current) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
        setTotal(data.total || 0);
        setCurrentPage(page);
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
    fetchNotifications(currentPage);
  }, [fetchNotifications, currentPage]);

  // Go to specific page
  const goToPage = useCallback((page) => {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.max(1, Math.min(page, maxPage));
    fetchNotifications(safePage);
  }, [fetchNotifications, total]);

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
      setTotal(prev => Math.max(0, prev - 1));
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
      // Refresh to get accurate totals from server
      setTimeout(() => fetchNotifications(1), 300);
      return true;
    } catch (err) {
      console.error('Failed to clear read:', err);
      return false;
    }
  }, [fetchNotifications]);

  // Initial fetch when authenticated
  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated) {
      fetchNotifications(1);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      setCurrentPage(1);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const value = {
    notifications,
    unreadCount,
    total,
    currentPage,
    totalPages,
    pageSize: PAGE_SIZE,
    loading,
    refresh, // ← Call this after password reset!
    fetchNotifications,
    goToPage,
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