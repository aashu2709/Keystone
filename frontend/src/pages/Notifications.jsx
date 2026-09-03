/**
 * Notifications Page — With Google-style Pagination
 */

import { useState, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useNotificationContext } from '../context/NotificationContext';
import NotificationItem from '../components/notifications/NotificationItem';
import { showSuccess, showError } from '../utils/toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

const Notifications = () => {
  const [filter, setFilter] = useState('all');

  const {
    notifications, unreadCount, total, currentPage, totalPages, pageSize, loading,
    markAsRead, markAllAsRead, deleteNotification, clearRead, fetchNotifications, goToPage,
  } = useNotificationContext();

  useEffect(() => { fetchNotifications(1); }, [fetchNotifications]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const handleMarkAllAsRead = async () => {
    const ok = await markAllAsRead();
    ok ? showSuccess('All notifications marked as read') : showError('Failed to mark notifications as read');
  };

  const handleClearRead = async () => {
    if (window.confirm('Delete all read notifications?')) {
      const ok = await clearRead();
      ok ? showSuccess('Read notifications cleared') : showError('Failed to clear notifications');
    }
  };

  const handleRefresh = () => { fetchNotifications(currentPage); showSuccess('Notifications refreshed'); };

  const handleDelete = async (id) => {
    const ok = await deleteNotification(id);
    if (ok) showSuccess('Notification deleted');
  };

  // Calculate showing range
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  // Generate page numbers for Google-style pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 10;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      let startPage = Math.max(2, currentPage - 3);
      let endPage = Math.min(totalPages - 1, currentPage + 3);

      // Adjust range to show ~7 middle pages
      if (currentPage <= 4) {
        endPage = Math.min(totalPages - 1, 8);
      } else if (currentPage >= totalPages - 3) {
        startPage = Math.max(2, totalPages - 7);
      }

      if (startPage > 2) pages.push('...');

      for (let i = startPage; i <= endPage; i++) pages.push(i);

      if (endPage < totalPages - 1) pages.push('...');

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} total, {unreadCount} unread
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
                <TabsTrigger value="read">Read</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                  <CheckCheck className="h-4 w-4" />
                  Mark All Read
                </Button>
              )}
              {notifications.some((n) => n.is_read) && (
                <Button variant="ghost" size="sm" onClick={handleClearRead} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Clear Read
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading notifications...</p>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {filter === 'all' ? 'No notifications yet' : filter === 'unread' ? 'No unread notifications' : 'No read notifications'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? "You're all caught up!" : "Notifications will appear here."}
              </p>
            </CardContent>
          </Card>
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

      {/* Google-style Pagination */}
      {totalPages > 1 && !loading && (
        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Showing info */}
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{startItem}</span> – <span className="font-medium text-foreground">{endItem}</span> of{' '}
                <span className="font-medium text-foreground">{total}</span> notifications
              </p>

              {/* Pagination controls */}
              <div className="flex items-center gap-1">
                {/* First page */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, idx) =>
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground select-none">
                        …
                      </span>
                    ) : (
                      <Button
                        key={page}
                        variant={page === currentPage ? 'default' : 'ghost'}
                        size="icon"
                        className={cn(
                          "h-9 w-9 text-sm font-medium",
                          page === currentPage && "pointer-events-none"
                        )}
                        onClick={() => goToPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>

                {/* Next */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Last page */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Notifications;