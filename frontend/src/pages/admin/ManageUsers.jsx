/**
 * Admin: Manage Users Page
 * ========================
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, Button, Alert } from '../../components/ui';
import {
  Users,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await adminAPI.getUsers({ search: searchTerm });
      setUsers(response.users || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchTerm]);

  const handleRoleChange = async (user, newRole) => {
    if (!window.confirm(`Change ${user.full_name}'s role to "${newRole}"?`)) {
      return;
    }

    try {
      await adminAPI.updateUserRole(user.id, newRole);
      setSuccess(`Role updated for ${user.full_name}`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update role');
    }
  };

  const handleStatusToggle = async (user) => {
    const newStatus = !user.is_active;
    const action = newStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return;
    }

    try {
      await adminAPI.updateUserStatus(user.id, newStatus);
      setSuccess(`User ${action}d successfully`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${action} user`);
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      superadmin: 'bg-purple-100 text-purple-700',
      admin: 'bg-blue-100 text-blue-700',
      user: 'bg-gray-100 text-gray-700',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role] || styles.user}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Users</h1>
          <p className="text-gray-500 mt-1">View and manage user accounts</p>
        </div>
        <Button variant="secondary" onClick={fetchUsers}>
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search users by name, email, or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Users Found</h3>
            <p className="mt-2 text-gray-500">
              {searchTerm ? 'No users match your search.' : 'No users in the system.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-800">{user.full_name}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Role Selector */}
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="superadmin">Super Admin</option>
                        </select>

                        {/* Status Toggle */}
                        <button
                          onClick={() => handleStatusToggle(user)}
                          className={`p-2 rounded-lg ${user.is_active
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-green-500 hover:bg-green-50'
                            }`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary */}
      {users.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Total: {users.length} user{users.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ManageUsers;