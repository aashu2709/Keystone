/**
 * Admin: Manage Users — Shadcn UI Redesign
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Users, RefreshCw, UserCheck, UserX } from 'lucide-react';

const roleVariant = { superadmin: 'purple', admin: 'info', user: 'secondary' };

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.getUsers({});
      setUsers(response.users || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = async (user, newRole) => {
    if (!window.confirm(`Change ${user.full_name}'s role to "${newRole}"?`)) return;
    try {
      await adminAPI.updateUserRole(user.id, newRole);
      setSuccess(`Role updated for ${user.full_name}`);
      fetchUsers();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to update role'); }
  };

  const handleStatusToggle = async (user) => {
    const newStatus = !user.is_active;
    const action = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.full_name}?`)) return;
    try {
      await adminAPI.updateUserStatus(user.id, newStatus);
      setSuccess(`User ${action}d successfully`);
      fetchUsers();
    } catch (err) { setError(err.response?.data?.detail || `Failed to ${action} user`); }
  };

  const columns = [
    {
      header: 'User',
      accessorKey: 'full_name',
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.full_name}</p>
          <p className="text-xs text-muted-foreground">@{row.username}</p>
        </div>
      ),
    },
    { header: 'Email', accessorKey: 'email', cell: (row) => <span className="text-muted-foreground">{row.email}</span> },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: (row) => <Badge variant={roleVariant[row.role] || 'secondary'}>{row.role}</Badge>,
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: (row) => <StatusBadge status={row.is_active ? 'active' : 'disabled'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      cellClassName: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <select
            value={row.role}
            onChange={(e) => handleRoleChange(row, e.target.value)}
            className="text-xs border border-input rounded-md px-2 py-1 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
          <button
            onClick={() => handleStatusToggle(row)}
            className={`p-1.5 rounded-md transition-colors ${row.is_active ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-600 hover:bg-emerald-50'}`}
            title={row.is_active ? 'Deactivate' : 'Activate'}
          >
            {row.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Manage Users</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage user accounts</p>
        </div>
        <Button variant="outline" onClick={fetchUsers}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchPlaceholder="Search users..."
        searchKeys={['full_name', 'email', 'username']}
        emptyIcon={Users}
        emptyTitle="No Users Found"
        emptyDescription="No users in the system."
      />
    </div>
  );
};

export default ManageUsers;