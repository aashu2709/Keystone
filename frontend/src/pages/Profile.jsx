/**
 * Profile Page — Shadcn UI Redesign
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { vmAPI, passwordAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Separator } from '@/components/ui/Separator';
import StatCard from '@/components/StatCard';
import { User, Mail, Shield, Calendar, Clock, Server, KeyRound, Loader2 } from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
};

const avatarColor = (name = '') => {
  const palette = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

const roleVariantMap = { superadmin: 'purple', admin: 'info', user: 'secondary' };
const roleLabelMap = { superadmin: 'Super Admin', admin: 'Admin', user: 'User' };

const DetailRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-3">
    <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  </div>
);

const Profile = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ vms: null, resets: null });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [vmsRes, auditRes] = await Promise.all([
          vmAPI.getMyVMs().catch(() => ({ vms: [] })),
          passwordAPI.getAuditLogs({ limit: 1 }).catch(() => ({ total: 0 })),
        ]);
        setStats({ vms: (vmsRes.vms || []).length, resets: auditRes.total || 0 });
      } finally { setLoadingStats(false); }
    };
    fetchStats();
  }, []);

  const initials = (user?.full_name || user?.username || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color = avatarColor(user?.username || '');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">View your account information and activity.</p>
      </div>

      {/* Identity Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className={`w-16 h-16 rounded-xl ${color} flex items-center justify-center shrink-0 shadow-md`}>
              <span className="text-xl font-bold text-white tracking-wide">{initials}</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-bold text-foreground">{user?.full_name}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                <Badge variant={roleVariantMap[user?.role] || 'secondary'}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabelMap[user?.role] || user?.role}
                </Badge>
                <Badge variant={user?.is_active ? 'success' : 'danger'}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="secondary">
                  <Calendar className="h-3 w-3 mr-1" />
                  Member since {formatDate(user?.created_at)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="VMs Assigned" value={loadingStats ? '...' : stats.vms ?? '—'} icon={Server} iconColor="text-blue-600" iconBg="bg-blue-50" loading={loadingStats} subtitle="Servers you manage" />
        <StatCard title="Password Resets" value={loadingStats ? '...' : stats.resets ?? '—'} icon={KeyRound} iconColor="text-emerald-600" iconBg="bg-emerald-50" loading={loadingStats} subtitle="Lifetime resets" />
        <StatCard title="Last Login" value={formatTimeAgo(user?.last_login)} icon={Clock} iconColor="text-orange-600" iconBg="bg-orange-50" subtitle={user?.last_login ? formatDateTime(user.last_login) : undefined} />
      </div>

      {/* Account Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            <DetailRow icon={User} label="Full Name">{user?.full_name}</DetailRow>
            <DetailRow icon={User} label="Username">@{user?.username}</DetailRow>
            <DetailRow icon={Mail} label="Email Address">{user?.email}</DetailRow>
            <DetailRow icon={Shield} label="Role">
              <Badge variant={roleVariantMap[user?.role] || 'secondary'}>{roleLabelMap[user?.role] || user?.role}</Badge>
            </DetailRow>
            <DetailRow icon={Calendar} label="Account Created">{formatDateTime(user?.created_at)}</DetailRow>
            <DetailRow icon={Clock} label="Last Login">{formatDateTime(user?.last_login)}</DetailRow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
