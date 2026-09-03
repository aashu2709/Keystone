/**
 * Dashboard — Shadcn UI Redesign
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { vmAPI, notificationAPI, passwordAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import StatCard from '@/components/StatCard';
import { Link } from 'react-router-dom';
import {
  Server, KeyRound, Bell, Activity, Clock, CheckCircle2, XCircle,
  Loader2, Shield, ChevronRight, Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

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
    password_reset: 'Password Reset', login: 'Login', logout: 'Logout',
    create_vm: 'VM Created', update_vm: 'VM Updated', delete_vm: 'VM Deleted',
  };
  return labels[action] || action.replace(/_/g, ' ');
};

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem('dashboard_welcome_shown'));
  const [myVMs, setMyVMs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [passwordResetCount, setPasswordResetCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    if (showWelcome) {
      sessionStorage.setItem('dashboard_welcome_shown', 'true');
      const timer = setTimeout(() => setShowWelcome(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showWelcome]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [vmsResponse, notifResponse, resetAuditResponse, activityAuditResponse] = await Promise.all([
        vmAPI.getMyVMs().catch(() => ({ vms: [] })),
        notificationAPI.getUnreadCount().catch(() => ({ unread_count: 0 })),
        passwordAPI.getAuditLogs({ limit: 1000, action: 'password_reset' }).catch(() => ({ logs: [], total: 0 })),
        passwordAPI.getAuditLogs({ limit: 10 }).catch(() => ({ logs: [], total: 0 })),
      ]);

      setMyVMs(vmsResponse.vms || []);
      setUnreadCount(notifResponse.unread_count || 0);
      const successfulResets = (resetAuditResponse.logs || []).filter(log => log.details?.success !== false).length;
      setPasswordResetCount(successfulResets);

      setRecentActivity((activityAuditResponse.logs || []).slice(0, 5).map(log => ({
        id: log.id,
        action: formatActionLabel(log.action),
        vm: log.details?.vm_name || null,
        time: formatTimeAgo(log.timestamp),
        status: log.details?.success !== false ? 'success' : 'failed',
      })));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const expiringVMs = myVMs.filter(vm => vm.days_until_expiry !== null && vm.days_until_expiry !== undefined && vm.days_until_expiry <= 7).length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white shadow-lg">
        <AnimatePresence>
          {showWelcome && (
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.4 }}
              className="text-2xl font-bold mb-1"
            >
              Welcome back, {user?.full_name}!
            </motion.h1>
          )}
        </AnimatePresence>
        <p className="text-blue-100 font-medium">Manage your VM passwords securely.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total VMs" value={loading ? '...' : myVMs.length} icon={Server} iconColor="text-blue-600" iconBg="bg-blue-50" loading={loading} />
        <StatCard title="Password Resets" value={loading ? '...' : passwordResetCount} icon={KeyRound} iconColor="text-emerald-600" iconBg="bg-emerald-50" loading={loading} />
        <StatCard title="Notifications" value={loading ? '...' : unreadCount} icon={Bell} iconColor="text-orange-600" iconBg="bg-orange-50" loading={loading} />
        <StatCard title="Expiring Soon" value={loading ? '...' : expiringVMs} icon={Shield} iconColor="text-purple-600" iconBg="bg-purple-50" loading={loading} />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { to: '/vm-password-reset', icon: KeyRound, label: 'Reset Password', desc: 'Change VM credentials', color: 'text-primary', border: 'hover:border-primary/50' },
              { to: '/vms', icon: Server, label: 'My VMs', desc: 'View all servers', color: 'text-foreground', border: 'hover:border-border' },
              { to: '/notifications', icon: Bell, label: 'Notifications', desc: unreadCount > 0 ? `${unreadCount} unread` : 'All caught up', color: 'text-foreground', border: 'hover:border-border', badge: unreadCount },
            ].map(({ to, icon: Icon, label, desc, color, border, badge }) => (
              <Link key={to} to={to} className="group">
                <div className={`flex items-center gap-3 p-4 rounded-lg border border-border transition-all ${border} hover:bg-accent/50`}>
                  <div className="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors relative">
                    <Icon className={`h-5 w-5 ${color}`} />
                    {badge > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">{badge}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Your latest actions</p>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`p-1.5 rounded-full shrink-0 ${activity.status === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      {activity.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      {activity.vm && <p className="text-xs text-muted-foreground truncate">{activity.vm}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />{activity.time}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3"><Activity className="h-5 w-5 text-muted-foreground" /></div>
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Password Status</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Expiring passwords</p>
              </div>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : myVMs.length > 0 ? (
              <div className="space-y-2">
                {myVMs
                  .sort((a, b) => {
                    const dA = a.days_until_expiry, dB = b.days_until_expiry;
                    if (dA === null && dB === null) return 0;
                    if (dA === null) return 1;
                    if (dB === null) return -1;
                    return dA - dB;
                  })
                  .slice(0, 4)
                  .map((vm) => {
                    const d = vm.days_until_expiry;
                    let variant = 'secondary', text = 'Never Expires';
                    if (d !== null && d !== undefined) {
                      text = `${d} days`;
                      variant = d <= 7 ? 'danger' : d <= 14 ? 'warning' : 'success';
                    }
                    return (
                      <div key={vm.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-border/80 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${variant === 'danger' ? 'bg-red-50' : variant === 'warning' ? 'bg-amber-50' : variant === 'success' ? 'bg-emerald-50' : 'bg-muted'}`}>
                            <Server className={`h-4 w-4 ${variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : variant === 'success' ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{vm.name}</p>
                            <p className="text-xs text-muted-foreground">{vm.ip_address} · {vm.local_username}</p>
                          </div>
                        </div>
                        <Badge variant={variant}>{text}</Badge>
                      </div>
                    );
                  })}
                {myVMs.length > 4 && (
                  <Link to="/vms" className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary/80 font-medium pt-2 border-t border-border transition-colors">
                    View +{myVMs.length - 4} more VMs <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="rounded-full bg-muted p-3 w-fit mx-auto mb-3"><Shield className="h-5 w-5 text-muted-foreground" /></div>
                <p className="text-sm text-muted-foreground mb-2">No VMs assigned</p>
                <Button variant="outline" size="sm">Request Access</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;