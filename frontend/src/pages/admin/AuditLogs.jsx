/**
 * Admin: Audit Logs Page
 * ======================
 * View all system activity and security events.
 * Supports filtering by action type, search, and pagination.
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, Button, Alert } from '../../components/ui';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Server,
  KeyRound,
  Shield,
  Activity,
  UserPlus,
  UserX,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ===========================================
// ACTION TYPE CONFIGURATIONS
// ===========================================

const ACTION_CONFIG = {
  password_reset: {
    label: 'Password Reset',
    icon: KeyRound,
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  create_vm: {
    label: 'VM Created',
    icon: Server,
    bg: 'bg-green-100',
    text: 'text-green-700',
  },
  update_vm: {
    label: 'VM Updated',
    icon: Server,
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
  },
  delete_vm: {
    label: 'VM Deleted',
    icon: Server,
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  create_mapping: {
    label: 'Mapping Created',
    icon: LinkIcon,
    bg: 'bg-green-100',
    text: 'text-green-700',
  },
  update_mapping: {
    label: 'Mapping Updated',
    icon: LinkIcon,
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
  },
  delete_mapping: {
    label: 'Mapping Deleted',
    icon: LinkIcon,
    bg: 'bg-red-100',
    text: 'text-red-700',
  },
  update_user_role: {
    label: 'Role Changed',
    icon: Shield,
    bg: 'bg-purple-100',
    text: 'text-purple-700',
  },
  update_user_status: {
    label: 'Status Changed',
    icon: UserX,
    bg: 'bg-orange-100',
    text: 'text-orange-700',
  },
  health_check: {
    label: 'Health Check',
    icon: Activity,
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
  },
  health_check_all: {
    label: 'Check All VMs',
    icon: Activity,
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
  },
  login: {
    label: 'Login',
    icon: User,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  },
  signup: {
    label: 'Signup',
    icon: UserPlus,
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
  },
};

const getActionConfig = (action) => {
  return ACTION_CONFIG[action] || {
    label: action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    icon: FileText,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };
};

// ===========================================
// FORMAT HELPERS
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

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const formatFullDate = (dateString) => {
  if (!dateString) return 'Unknown';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDetails = (details) => {
  if (!details || Object.keys(details).length === 0) return null;

  return Object.entries(details).map(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let displayValue = value;

    if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      displayValue = JSON.stringify(value);
    } else if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    }

    return { label, value: String(displayValue) };
  });
};

// ===========================================
// FILTER OPTIONS
// ===========================================

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

// ===========================================
// MAIN COMPONENT
// ===========================================

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState({});

  const fetchLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
      };
      
      if (actionFilter) {
        params.action = actionFilter;
      }
      
      const response = await adminAPI.getAuditLogs(params);
      setLogs(response.logs || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, actionFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter]);

  const totalPages = Math.ceil(total / pageSize);

  const toggleRow = (logId) => {
    setExpandedRows(prev => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  // Filter logs by search term (client-side search on loaded data)
  const filteredLogs = searchTerm
    ? logs.filter(log =>
        log.user_username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Audit Logs</h1>
          <p className="text-gray-500 mt-1">
            View all system activity and security events
            {total > 0 && <span className="ml-2">({total} total entries)</span>}
          </p>
        </div>
        <Button variant="secondary" onClick={fetchLogs}>
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search logs by user, action, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Action Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white appearance-none min-w-[200px]"
          >
            {ACTION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Logs Found</h3>
            <p className="mt-2 text-gray-500">
              {actionFilter || searchTerm
                ? 'No logs match your filters.'
                : 'No audit logs recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 w-8"></th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Resource</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Summary</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const config = getActionConfig(log.action);
                  const ActionIcon = config.icon;
                  const details = formatDetails(log.details);
                  const isExpanded = expandedRows[log.id];
                  
                  return (
                    <>
                      {/* Main Row */}
                      <tr
                        key={log.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => details && toggleRow(log.id)}
                      >
                        {/* Expand Icon */}
                        <td className="py-3 px-4">
                          {details && details.length > 0 && (
                            <button className="text-gray-400 hover:text-gray-600">
                              {isExpanded ? (
                                <ChevronUp size={16} />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                          )}
                        </td>
                        
                        {/* User */}
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {log.user_full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              @{log.user_username}
                            </p>
                          </div>
                        </td>
                        
                        {/* Action Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`
                              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                              ${config.bg} ${config.text}
                            `}
                          >
                            <ActionIcon size={12} />
                            {config.label}
                          </span>
                        </td>
                        
                        {/* Resource */}
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {log.resource_type || '-'}
                        </td>
                        
                        {/* Summary */}
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                          {log.details?.vm_name && (
                            <span>VM: {log.details.vm_name}</span>
                          )}
                          {log.details?.user_username && !log.details?.vm_name && (
                            <span>User: {log.details.user_username}</span>
                          )}
                          {log.details?.old_role && log.details?.new_role && (
                            <span>{log.details.old_role} → {log.details.new_role}</span>
                          )}
                          {log.details?.ip_address && (
                            <span>IP: {log.details.ip_address}</span>
                          )}
                          {!log.details?.vm_name && !log.details?.user_username && 
                           !log.details?.old_role && !log.details?.ip_address && (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        
                        {/* Time */}
                        <td className="py-3 px-4 text-right">
                          <div>
                            <p className="text-sm text-gray-700">
                              {formatTimeAgo(log.timestamp)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatFullDate(log.timestamp)}
                            </p>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {isExpanded && details && (
                        <tr key={`${log.id}-details`} className="bg-gray-50">
                          <td colSpan="6" className="px-4 py-3">
                            <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {details.map((detail, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white px-3 py-2 rounded border border-gray-200"
                                >
                                  <p className="text-xs text-gray-500">{detail.label}</p>
                                  <p className="text-sm font-medium text-gray-800 break-all">
                                    {detail.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * pageSize) + 1} to{' '}
              {Math.min(currentPage * pageSize, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border ${
                  currentPage === 1
                    ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <ChevronLeft size={18} />
              </button>
              
              <span className="text-sm text-gray-600 px-3">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border ${
                  currentPage === totalPages
                    ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;