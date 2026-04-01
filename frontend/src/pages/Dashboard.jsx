/**
 * Professional Dashboard - Enhanced UX
 * Features:
 * - Modern card-based layout
 * - Quick stats with visual indicators
 * - Recent activity timeline
 * - Password expiry alerts
 * - Quick actions
 * - Responsive design
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { vmAPI, notificationAPI, passwordAPI } from '../services/api';
import { Card, Button } from '../components/ui';
import { Link } from 'react-router-dom';
import {
  Server,
  KeyRound,
  Bell,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  ChevronRight,
  Zap,
} from 'lucide-react';

// ===========================================
// HELPER FUNCTIONS
// ===========================================
const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString();
};

const formatActionLabel = (action) => {
  const labels = {
    password_reset: 'Password Reset',
    login: 'Login',
    logout: 'Logout',
    create_vm: 'VM Created',
    update_vm: 'VM Updated',
    delete_vm: 'VM Deleted',
  };
  return labels[action] || action.replace(/_/g, ' ');
};

// ===========================================
// MAIN COMPONENT
// ===========================================
const Dashboard = () => {
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);

  // Check if welcome should be shown (only on first visit after login)
  const [showWelcome, setShowWelcome] = useState(() => {
    const hasShownWelcome = sessionStorage.getItem('dashboard_welcome_shown');
    return !hasShownWelcome;
  });
  const [welcomeFading, setWelcomeFading] = useState(false);

  const [myVMs, setMyVMs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [passwordResetCount, setPasswordResetCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);

  // Welcome animation - only runs if showWelcome is true
  useEffect(() => {
    if (!showWelcome) return;
    sessionStorage.setItem('dashboard_welcome_shown', 'true');
    const fadeTimer = setTimeout(() => setWelcomeFading(true), 2000);
    const removeTimer = setTimeout(() => setShowWelcome(false), 2500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [showWelcome]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [vmsResponse, notifResponse, resetAuditResponse, activityAuditResponse] = await Promise.all([
        vmAPI.getMyVMs().catch(() => ({ vms: [] })),
        notificationAPI.getUnreadCount().catch(() => ({ unread_count: 0 })),
        // Filtered: password_reset only → for the stat count
        passwordAPI.getAuditLogs({ limit: 1000, action: 'password_reset' }).catch(() => ({ logs: [], total: 0 })),
        // Unfiltered: all actions → for Recent Activity timeline
        passwordAPI.getAuditLogs({ limit: 10 }).catch(() => ({ logs: [], total: 0 })),
      ]);

      setMyVMs(vmsResponse.vms || []);
      setUnreadCount(notifResponse.unread_count || 0);
      // Count only successful password resets
      const successfulResets = (resetAuditResponse.logs || []).filter(
        (log) => log.details?.success !== false
      ).length;
      setPasswordResetCount(successfulResets);

      const formattedActivity = (activityAuditResponse.logs || []).slice(0, 5).map(log => ({
        id: log.id,
        action: formatActionLabel(log.action),
        vm: log.details?.vm_name || null,
        time: formatTimeAgo(log.timestamp),
        timestamp: log.timestamp,
        status: log.details?.success !== false ? 'success' : 'failed',
      }));

      setRecentActivity(formattedActivity);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Silent auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Calculate stats — real data
  const expiringVMs = myVMs.filter(
    (vm) => vm.days_until_expiry !== null && vm.days_until_expiry !== undefined && vm.days_until_expiry <= 7
  ).length;

  // ===========================================
  // RENDER
  // ===========================================
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ==========================================
          WELCOME SECTION
          ========================================== */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white shadow-lg overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Welcome message - only shows on first visit after login */}
            {showWelcome && (
              <div
                className={`
                  transition-all duration-500 ease-out overflow-hidden
                  ${welcomeFading ? 'opacity-0 max-h-0 mb-0' : 'opacity-100 max-h-20 mb-1'}
                `}
              >
                <h1 className="text-2xl font-bold">
                  Welcome back, {user?.full_name}!
                </h1>
              </div>
            )}
            {/* Subtitle - stays */}
            <p className="text-primary-50 font-bold">
              Manage your VM passwords securely.
            </p>
          </div>
        </div>
      </div>

      {/* ==========================================
          STATS OVERVIEW
          ========================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total VMs */}
        <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total VMs</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : myVMs.length}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Server className="text-blue-600" size={24} />
            </div>
          </div>
        </Card>

        {/* Password Resets */}
        <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Password Resets</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : passwordResetCount}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <KeyRound className="text-green-600" size={24} />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Notifications</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : unreadCount}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Bell className="text-orange-600" size={24} />
            </div>
          </div>
        </Card>

        {/* Expiring Passwords */}
        <Card className="card-hover animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Expiring Soon</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '...' : expiringVMs}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Shield className="text-purple-600" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* ==========================================
          QUICK ACTIONS
          ========================================== */}
      <Card className="animate-slide-up" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <Zap className="text-yellow-500" size={20} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/vm-password-reset" className="group">
            <div className="p-4 border-2 border-primary-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                  <KeyRound className="text-primary-700" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 group-hover:text-primary-700 transition-colors">
                    Reset Password
                  </p>
                  <p className="text-xs text-gray-500">Change VM credentials</p>
                </div>
                <ChevronRight className="text-gray-400 group-hover:text-primary-600 transition-colors" size={16} />
              </div>
            </div>
          </Link>

          <Link to="/vms" className="group">
            <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                  <Server className="text-gray-700" size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                    My VMs
                  </p>
                  <p className="text-xs text-gray-500">View all servers</p>
                </div>
                <ChevronRight className="text-gray-400 group-hover:text-gray-600 transition-colors" size={16} />
              </div>
            </div>
          </Link>

          <Link to="/notifications" className="group">
            <div className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors relative">
                  <Bell className="text-gray-700" size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                    Notifications
                  </p>
                  <p className="text-xs text-gray-500">
                    {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                  </p>
                </div>
                <ChevronRight className="text-gray-400 group-hover:text-gray-600 transition-colors" size={16} />
              </div>
            </div>
          </Link>
        </div>
      </Card>

      {/* ==========================================
          MAIN CONTENT GRID
          ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Activity */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <p className="text-sm text-gray-500">Your latest actions</p>
            </div>
            <Activity className="text-gray-400" size={20} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ animationDelay: `${0.7 + index * 0.1}s` }}
                >
                  {/* Status Icon */}
                  <div className={`p-2 rounded-full flex-shrink-0 ${activity.status === 'success'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                    }`}>
                    {activity.status === 'success' ? (
                      <CheckCircle className="text-green-600" size={16} />
                    ) : (
                      <XCircle className="text-red-600" size={16} />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {activity.action}
                    </p>
                    {activity.vm && (
                      <p className="text-xs text-gray-500 truncate">{activity.vm}</p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock size={12} />
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Activity className="text-gray-400" size={24} />
              </div>
              <p className="text-sm text-gray-500 mb-1">No recent activity</p>
              <p className="text-xs text-gray-400">Your actions will appear here</p>
            </div>
          )}
        </Card>

        {/* Password Expiry Status */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Password Status</h2>
              <p className="text-sm text-gray-500">Expiring passwords</p>
            </div>
            <Shield className="text-gray-400" size={20} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : myVMs.length > 0 ? (
            <div className="space-y-3">
              {/* SORT and SLICE logic */}
              {myVMs
                .sort((a, b) => {
                  // Sort Logic:
                  // 1. Valid days come before Null/Unknown
                  // 2. Smaller days (urgent) come first
                  const daysA = a.days_until_expiry;
                  const daysB = b.days_until_expiry;

                  if (daysA === null && daysB === null) return 0;
                  if (daysA === null) return 1; // Put A last
                  if (daysB === null) return -1; // Put B last

                  return daysA - daysB;
                })
                .slice(0, 4) // Show top 4
                .map((vm) => {
                  const daysLeft = vm.days_until_expiry;

                  // Determine status style
                  let statusColor = 'bg-gray-100 text-gray-700';
                  let iconColor = 'text-gray-400';
                  let bgIcon = 'bg-gray-50';
                  let displayText = 'Password Never Expires';

                  if (daysLeft !== null && daysLeft !== undefined) {
                    displayText = `${daysLeft} days`;
                    if (daysLeft <= 7) {
                      statusColor = 'bg-red-100 text-red-700';
                      iconColor = 'text-red-600';
                      bgIcon = 'bg-red-50';
                    } else if (daysLeft <= 14) {
                      statusColor = 'bg-yellow-100 text-yellow-700';
                      iconColor = 'text-yellow-600';
                      bgIcon = 'bg-yellow-50';
                    } else {
                      statusColor = 'bg-green-100 text-green-700';
                      iconColor = 'text-green-600';
                      bgIcon = 'bg-green-50';
                    }
                  } else {
                    displayText = "Password Never Expires";
                  }

                  return (
                    <div
                      key={vm.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${bgIcon}`}>
                          <Server className={iconColor} size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {vm.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{vm.ip_address}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500 font-medium">{vm.local_username}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        title={
                          daysLeft !== null && daysLeft !== undefined
                            ? `Expires on ${new Date(Date.now() + daysLeft * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
                            : 'Expiry date unknown'
                        }
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColor}`}
                      >
                        {displayText}
                      </div>
                    </div>
                  );
                })}

              {/* View More Link */}
              {myVMs.length > 4 && (
                <Link
                  to="/vms"
                  className="flex items-center justify-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium pt-3 border-t border-gray-100"
                >
                  View +{myVMs.length - 4} more VMs
                  <ChevronRight size={12} />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Shield className="text-gray-400" size={24} />
              </div>
              <p className="text-sm text-gray-500 mb-1">No VMs assigned</p>
              <Button variant="secondary" className="text-sm">
                Request Access
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;