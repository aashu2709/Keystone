/**
 * Admin Dashboard Page
 * ====================
 * Enhanced dashboard for admins with system-wide statistics.
 * 
 * Shows:
 * - Total Users, VMs, Mappings, Password Resets
 * - VM Health Overview
 * - Recent System Activity
 * - System Overview Panel
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import { Card, Button } from '../../components/ui';
import { Link } from 'react-router-dom';
import {
  Server,
  KeyRound,
  Bell,
  Activity,
  Clock,
  CheckCircle,
  Users,
  Shield,
  FileText,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

// ===========================================
// HELPER: Format time ago
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
  
  return date.toLocaleDateString();
};

// ===========================================
// ACTION LABELS
// ===========================================
const ACTION_LABELS = {
  password_reset: 'Password Reset',
  create_vm: 'VM Created',
  update_vm: 'VM Updated',
  delete_vm: 'VM Deleted',
  create_mapping: 'Mapping Created',
  delete_mapping: 'Mapping Deleted',
  update_user_role: 'Role Changed',
  update_user_status: 'Status Changed',
  health_check: 'Health Check',
  health_check_all: 'Health Check All',
};

// ===========================================
// MAIN COMPONENT
// ===========================================
const AdminDashboard = () => {
  const { user } = useAuth();
  
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Admin stats
  const [stats, setStats] = useState(null);

  // ===========================================
  // FETCH DATA
  // ===========================================
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      
      try {
        const statsData = await adminAPI.getStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdminData();
  }, []);

  // ===========================================
  // STATS CARDS
  // ===========================================
  const statCards = stats ? [
    {
      label: 'Total Users',
      value: stats.users.total,
      subtitle: `${stats.users.active} active`,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
      link: '/admin/users',
    },
    {
      label: 'Total VMs',
      value: stats.vms.total,
      subtitle: `${stats.vms.healthy} healthy`,
      icon: Server,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      link: '/admin/vms',
    },
    {
      label: 'Password Resets',
      value: stats.password_resets.total,
      subtitle: `${stats.password_resets.today} today`,
      icon: KeyRound,
      color: 'text-green-600',
      bg: 'bg-green-100',
      link: '/admin/audit',
    },
    {
      label: 'VM Health',
      value: `${stats.vms.healthy}/${stats.vms.active}`,
      subtitle: stats.vms.unreachable > 0 ? `${stats.vms.unreachable} unreachable` : 'All healthy',
      icon: Activity,
      color: stats.vms.unreachable > 0 ? 'text-red-600' : 'text-green-600',
      bg: stats.vms.unreachable > 0 ? 'bg-red-100' : 'bg-green-100',
      link: '/admin/vms',
    },
  ] : [];

  // ===========================================
  // RENDER
  // ===========================================
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {user?.full_name}!</h1>
        <p className="mt-1 text-primary-100">
          Manage your system and monitor activity from your admin dashboard.
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-6 bg-gray-200 rounded w-16 mb-1" />
                <div className="h-4 bg-gray-100 rounded w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Link key={stat.label} to={stat.link}>
              <Card className="flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={stat.color} size={24} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-gray-400">{stat.subtitle}</p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Link to="/admin/users">
            <Button variant="primary" className="w-full">
              <Users size={18} />
              Manage Users
            </Button>
          </Link>
          <Link to="/admin/vms">
            <Button variant="secondary" className="w-full">
              <Server size={18} />
              Manage VMs
            </Button>
          </Link>
          <Link to="/admin/mappings">
            <Button variant="secondary" className="w-full">
              <Shield size={18} />
              User Mappings
            </Button>
          </Link>
          <Link to="/admin/audit">
            <Button variant="secondary" className="w-full">
              <FileText size={18} />
              Audit Logs
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card title="Recent System Activity">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary-600" size={24} />
            </div>
          ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activity.slice(0, 6).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="p-2 rounded-full bg-green-100">
                    <CheckCircle className="text-green-600" size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">
                      {ACTION_LABELS[activity.action] || activity.action}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      by @{activity.user_username}
                      {activity.details?.vm_name && ` • ${activity.details.vm_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                    <Clock size={12} />
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
              
              <Link
                to="/admin/audit"
                className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:text-primary-700 pt-2"
              >
                View all logs <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </Card>

        {/* System Overview */}
        <Card title="System Overview">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-primary-600" size={24} />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              {/* Users Breakdown */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Users</span>
                  <span className="text-sm text-gray-500">
                    {stats.users.total} total
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">
                    ● {stats.users.active} active
                  </span>
                  <span className="text-red-600">
                    ● {stats.users.inactive} inactive
                  </span>
                  <span className="text-purple-600">
                    ● {stats.users.admins} admins
                  </span>
                </div>
              </div>

              {/* VM Health Breakdown */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">VM Health</span>
                  <span className="text-sm text-gray-500">
                    {stats.vms.active} active
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-green-600">
                    🟢 {stats.vms.healthy} healthy
                  </span>
                  <span className="text-red-600">
                    🔴 {stats.vms.unreachable} unreachable
                  </span>
                  <span className="text-gray-500">
                    ⚪ {stats.vms.unknown} unknown
                  </span>
                </div>
              </div>

              {/* Mappings */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    User-VM Mappings
                  </span>
                  <span className="text-sm text-gray-500">
                    {stats.mappings.total} total
                  </span>
                </div>
              </div>

              {/* Password Resets */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Password Resets
                  </span>
                  <span className="text-sm text-gray-500">
                    {stats.password_resets.total} total
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-blue-600">
                    Today: {stats.password_resets.today}
                  </span>
                  <span className="text-blue-600">
                    This week: {stats.password_resets.this_week}
                  </span>
                </div>
              </div>

              {/* Audit Logs */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Audit Log Entries
                  </span>
                  <span className="text-sm text-gray-500">
                    {stats.audit_logs.total} total
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm">Failed to load stats</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;