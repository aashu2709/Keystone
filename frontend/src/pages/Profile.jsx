/**
 * Profile Page
 * ============
 * Displays the current user's account overview and stats.
 *
 * Sections:
 *  1. Avatar + Identity (name, username, role, status, member since)
 *  2. Stats row (VMs assigned, password resets, last login)
 *  3. Account Details card (email, username, role, created_at, last_login)
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { vmAPI, passwordAPI } from '../services/api';
import { Card } from '../components/ui';
import {
    User,
    Mail,
    Shield,
    Calendar,
    Clock,
    Server,
    KeyRound,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
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

// Generates a consistent avatar colour from a string (username)
const avatarColor = (name = '') => {
    const palette = [
        'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
        'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
        'bg-indigo-500', 'bg-pink-500', 'bg-teal-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
};

const roleConfig = {
    superadmin: { label: 'Super Admin', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    admin: { label: 'Admin', className: 'bg-blue-100   text-blue-700   border-blue-200' },
    user: { label: 'User', className: 'bg-gray-100   text-gray-700   border-gray-200' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
    <Card className="flex items-center gap-4">
        <div className={`p-3 rounded-xl flex-shrink-0 ${iconBg}`}>
            <Icon size={22} className={iconColor} />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
    </Card>
);

// ─── Detail Row ───────────────────────────────────────────────────────────────

const DetailRow = ({ icon: Icon, label, children }) => (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="p-1.5 rounded-lg bg-gray-100 flex-shrink-0 mt-0.5">
            <Icon size={15} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
            <div className="text-sm font-medium text-gray-800">{children}</div>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

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
                setStats({
                    vms: (vmsRes.vms || []).length,
                    resets: auditRes.total || 0,
                });
            } finally {
                setLoadingStats(false);
            }
        };
        fetchStats();
    }, []);

    const role = roleConfig[user?.role] ?? roleConfig.user;
    const initials = (user?.full_name || user?.username || 'U')
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const color = avatarColor(user?.username || '');

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">

            {/* ── Page Header ── */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
                <p className="text-gray-500 mt-1">View your account information and activity.</p>
            </div>

            {/* ── Identity Card ── */}
            <Card>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl ${color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <span className="text-2xl font-bold text-white tracking-wide">{initials}</span>
                    </div>

                    {/* Primary info */}
                    <div className="flex-1 text-center sm:text-left">
                        <h2 className="text-xl font-bold text-gray-900">{user?.full_name}</h2>
                        <p className="text-gray-500 text-sm mt-0.5">@{user?.username}</p>

                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                            {/* Role badge */}
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${role.className}`}>
                                <Shield size={12} />
                                {role.label}
                            </span>

                            {/* Status badge */}
                            {user?.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <CheckCircle size={12} />
                                    Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
                                    <XCircle size={12} />
                                    Inactive
                                </span>
                            )}

                            {/* Member since */}
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <Calendar size={12} />
                                Member since {formatDate(user?.created_at)}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Server}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="VMs Assigned"
                    value={loadingStats ? <Loader2 size={20} className="animate-spin text-gray-400" /> : stats.vms ?? '—'}
                    sub="Servers you manage"
                />
                <StatCard
                    icon={KeyRound}
                    iconBg="bg-green-50"
                    iconColor="text-green-600"
                    label="Password Resets"
                    value={loadingStats ? <Loader2 size={20} className="animate-spin text-gray-400" /> : stats.resets ?? '—'}
                    sub="Lifetime resets performed"
                />
                <StatCard
                    icon={Clock}
                    iconBg="bg-orange-50"
                    iconColor="text-orange-600"
                    label="Last Login"
                    value={
                        <span className="text-lg font-bold text-gray-900">
                            {formatTimeAgo(user?.last_login)}
                        </span>
                    }
                    sub={user?.last_login ? formatDateTime(user.last_login) : undefined}
                />
            </div>

            {/* ── Account Details ── */}
            <Card>
                <h3 className="text-base font-semibold text-gray-800 mb-2">Account Details</h3>
                <div className="divide-y divide-gray-100">
                    <DetailRow icon={User} label="Full Name">
                        {user?.full_name}
                    </DetailRow>
                    <DetailRow icon={User} label="Username">
                        @{user?.username}
                    </DetailRow>
                    <DetailRow icon={Mail} label="Email Address">
                        {user?.email}
                    </DetailRow>
                    <DetailRow icon={Shield} label="Role">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${role.className}`}>
                            {role.label}
                        </span>
                    </DetailRow>
                    <DetailRow icon={Calendar} label="Account Created">
                        {formatDateTime(user?.created_at)}
                    </DetailRow>
                    <DetailRow icon={Clock} label="Last Login">
                        {formatDateTime(user?.last_login)}
                    </DetailRow>
                </div>
            </Card>

        </div>
    );
};

export default Profile;
