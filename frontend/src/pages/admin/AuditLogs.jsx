/**
 * Admin: Audit Logs — Shadcn UI Redesign
 */

import { useState, useEffect, Fragment } from 'react';
import { adminAPI } from '../../services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import {
  FileText, RefreshCw, Search, Filter, ChevronLeft, ChevronRight,
  Clock, User, Server, KeyRound, Shield, Activity, UserPlus, UserX,
  Link as LinkIcon, ChevronDown, ChevronUp,
} from 'lucide-react';

const ACTION_CONFIG = {
  password_reset: { label: 'Password Reset', icon: KeyRound, variant: 'info' },
  create_vm: { label: 'VM Created', icon: Server, variant: 'success' },
  update_vm: { label: 'VM Updated', icon: Server, variant: 'warning' },
  delete_vm: { label: 'VM Deleted', icon: Server, variant: 'danger' },
  create_mapping: { label: 'Mapping Created', icon: LinkIcon, variant: 'success' },
  update_mapping: { label: 'Mapping Updated', icon: LinkIcon, variant: 'warning' },
  delete_mapping: { label: 'Mapping Deleted', icon: LinkIcon, variant: 'danger' },
  update_user_role: { label: 'Role Changed', icon: Shield, variant: 'purple' },
  update_user_status: { label: 'Status Changed', icon: UserX, variant: 'warning' },
  health_check: { label: 'Health Check', icon: Activity, variant: 'info' },
  health_check_all: { label: 'Check All VMs', icon: Activity, variant: 'info' },
  login: { label: 'Login', icon: User, variant: 'secondary' },
  signup: { label: 'Signup', icon: UserPlus, variant: 'purple' },
};

const getActionConfig = (action) => ACTION_CONFIG[action] || {
  label: action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  icon: FileText, variant: 'secondary',
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Unknown';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000), hours = Math.floor(diffMs / 3600000), days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatFullDate = (dateString) => {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatDetails = (details) => {
  if (!details || Object.keys(details).length === 0) return null;
  return Object.entries(details).map(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let displayValue = value;
    if (Array.isArray(value)) displayValue = value.join(', ');
    else if (typeof value === 'object' && value !== null) displayValue = JSON.stringify(value);
    else if (typeof value === 'boolean') displayValue = value ? 'Yes' : 'No';
    return { label, value: String(displayValue) };
  });
};

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'password_reset', label: 'Password Resets' },
  { value: 'create_vm', label: 'VM Created' },
  { value: 'update_vm', label: 'VM Updated' },
  { value: 'delete_vm', label: 'VM Deleted' },
  { value: 'create_mapping', label: 'Mapping Created' },
  { value: 'delete_mapping', label: 'Mapping Deleted' },
  { value: 'update_user_role', label: 'Role Changes' },
  { value: 'update_user_status', label: 'Status Changes' },
  { value: 'health_check', label: 'Health Checks' },
];

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [expandedRows, setExpandedRows] = useState({});

  const fetchLogs = async () => {
    setLoading(true); setError('');
    try {
      const params = { skip: (currentPage - 1) * pageSize, limit: pageSize };
      if (actionFilter) params.action = actionFilter;
      const response = await adminAPI.getAuditLogs(params);
      setLogs(response.logs || []); setTotal(response.total || 0);
    } catch (err) { setError(err.response?.data?.detail || 'Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [currentPage, actionFilter]);
  useEffect(() => { setCurrentPage(1); }, [actionFilter]);

  const totalPages = Math.ceil(total / pageSize);
  const toggleRow = (logId) => setExpandedRows(prev => ({ ...prev, [logId]: !prev[logId] }));

  const filteredLogs = searchTerm
    ? logs.filter(log =>
      log.user_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase())
    )
    : logs;

  const selectClass = "flex h-9 rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none min-w-[180px]";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System activity and security events{total > 0 && <span className="ml-1">({total} entries)</span>}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
            {ACTION_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16">
              <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4"><FileText className="h-8 w-8 text-muted-foreground" /></div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Logs Found</h3>
              <p className="text-sm text-muted-foreground">{actionFilter || searchTerm ? 'No logs match your filters.' : 'No audit logs yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs w-8"></th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">User</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Action</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Resource</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs">Summary</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const config = getActionConfig(log.action);
                    const ActionIcon = config.icon;
                    const details = formatDetails(log.details);
                    const isExpanded = expandedRows[log.id];
                    return (
                      <Fragment key={log.id}>
                        <tr className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => details && toggleRow(log.id)}>
                          <td className="py-3 px-4">
                            {details && details.length > 0 && (
                              <button className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-foreground">{log.user_full_name}</p>
                            <p className="text-xs text-muted-foreground">@{log.user_username}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={config.variant}>
                              <ActionIcon className="h-3 w-3 mr-1" />{config.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">{log.resource_type || '-'}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">
                            {log.details?.vm_name && <span>VM: {log.details.vm_name}</span>}
                            {log.details?.user_username && !log.details?.vm_name && <span>User: {log.details.user_username}</span>}
                            {log.details?.old_role && log.details?.new_role && <span>{log.details.old_role} → {log.details.new_role}</span>}
                            {log.details?.ip_address && !log.details?.vm_name && !log.details?.old_role && <span>IP: {log.details.ip_address}</span>}
                            {!log.details?.vm_name && !log.details?.user_username && !log.details?.old_role && !log.details?.ip_address && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <p className="text-xs text-foreground">{formatTimeAgo(log.timestamp)}</p>
                            <p className="text-[11px] text-muted-foreground">{formatFullDate(log.timestamp)}</p>
                          </td>
                        </tr>
                        {isExpanded && details && (
                          <tr className="bg-muted/30">
                            <td colSpan="6" className="px-4 py-3">
                              <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {details.map((detail, idx) => (
                                  <div key={idx} className="bg-background px-3 py-2 rounded-md border border-border">
                                    <p className="text-[11px] text-muted-foreground">{detail.label}</p>
                                    <p className="text-sm font-medium text-foreground break-all">{detail.value}</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;