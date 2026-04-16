/**
 * Admin: Manage User-VM Mappings Page
 * ====================================
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, Button, Input, Alert } from '../../components/ui';
import {
  Link as LinkIcon,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Save,
  User,
  Server,
} from 'lucide-react';

const ManageMappings = () => {
  const [mappings, setMappings] = useState([]);
  const [users, setUsers] = useState([]);
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    user_id: '',
    vm_id: '',
    local_username: '',
    can_reset_password: true,
    can_view_history: false,
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [mappingsRes, usersRes, vmsRes] = await Promise.all([
        adminAPI.getMappings(),
        adminAPI.getUsers(),
        adminAPI.getVMs(),
      ]);

      setMappings(mappingsRes.mappings || []);
      setUsers(usersRes.users || []);
      setVms(vmsRes.vms || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setFormData({
      user_id: '',
      vm_id: '',
      local_username: '',
      can_reset_password: true,
      can_view_history: false,
      notes: '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await adminAPI.createMapping(formData);
      setSuccess('Mapping created successfully');
      closeModal();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create mapping');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (mapping) => {
    if (!window.confirm(`Remove access for "${mapping.user_username}" to "${mapping.vm_name}"?`)) {
      return;
    }

    try {
      await adminAPI.deleteMapping(mapping.id);
      setSuccess('Mapping deleted successfully');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete mapping');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User-VM Mappings</h1>
          <p className="text-gray-500 mt-1">Assign users to VMs for password management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData}>
            <RefreshCw size={18} />
          </Button>
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={18} />
            Add Mapping
          </Button>
        </div>
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

      {/* Mappings Table */}
      <Card>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading mappings...</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8">
            <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No Mappings</h3>
            <p className="mt-2 text-gray-500">
              Create a mapping to assign a user to a VM.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">User</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">VM</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">VM Username</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Permissions</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-800">{mapping.user_full_name}</p>
                          <p className="text-sm text-gray-500">@{mapping.user_username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Server size={16} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-800">{mapping.vm_name}</p>
                          <p className="text-sm text-gray-500">{mapping.vm_ip_address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{mapping.local_username}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {mapping.can_reset_password && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            Reset Password
                          </span>
                        )}
                        {mapping.can_view_history && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            View History
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleDelete(mapping)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={18} />
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

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">Add New Mapping</h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User <span className="text-red-500">*</span>
                </label>
                <select
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">-- Select User --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} (@{user.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* VM Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VM <span className="text-red-500">*</span>
                </label>
                <select
                  name="vm_id"
                  value={formData.vm_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">-- Select VM --</option>
                  {vms.map(vm => (
                    <option key={vm.id} value={vm.id}>
                      {vm.name} ({vm.ip_address})
                    </option>
                  ))}
                </select>
              </div>

              {/* Local Username */}
              <Input
                label="VM Username"
                name="local_username"
                value={formData.local_username}
                onChange={handleChange}
                placeholder="e.g., john_prod"
                helperText="The Windows username on the VM"
                required
              />

              {/* Permissions */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Permissions</label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="can_reset_password"
                    checked={formData.can_reset_password}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Can reset password</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="can_view_history"
                    checked={formData.can_view_history}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Can view password history</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={submitting}>
                  <Save size={18} />
                  Create Mapping
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageMappings;