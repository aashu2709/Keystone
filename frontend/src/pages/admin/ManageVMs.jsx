/**
 * Admin: Manage VMs Page
 * ======================
 * With VM Health Check functionality
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Card, Button, Input, Alert } from '../../components/ui';
import VMHealthBadge from '../../components/VMHealthBadge';
import {
  Server,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Save,
  Search,
  Activity,
  Loader2,
} from 'lucide-react';

const ManageVMs = () => {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Health check states
  const [checkingHealth, setCheckingHealth] = useState({}); // { vmId: true/false }
  const [checkingAllHealth, setCheckingAllHealth] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedVm, setSelectedVm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    description: '',
    os_version: 'Windows Server 2022',
    winrm_port: 5985,
    admin_username: 'Administrator',
    admin_password: '',
  });

  const fetchVMs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await adminAPI.getVMs({ search: searchTerm });
      const raw = response.vms || [];
      setVms(raw.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load VMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVMs();
  }, [searchTerm]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // ===== Health Check Functions =====

  const handleCheckHealth = async (vm) => {
    setCheckingHealth(prev => ({ ...prev, [vm.id]: true }));
    setError('');

    try {
      const result = await adminAPI.checkVMHealth(vm.id);

      // Update the VM in local state
      setVms(prevVms => prevVms.map(v =>
        v.id === vm.id
          ? {
            ...v,
            health_status: result.health_status,
            last_health_check: result.last_health_check
          }
          : v
      ));

      // Show appropriate message
      const statusEmoji = result.health_status === 'healthy' ? '🟢' : '🔴';
      if (result.status_changed) {
        setSuccess(`${vm.name}: Status changed from ${result.previous_status} to ${result.health_status}`);
      } else {
        setSuccess(`${statusEmoji} ${vm.name}: ${result.health_status}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to check health for ${vm.name}`);
    } finally {
      setCheckingHealth(prev => ({ ...prev, [vm.id]: false }));
    }
  };

  const handleCheckAllHealth = async () => {
    setCheckingAllHealth(true);
    setError('');
    setSuccess('');

    try {
      const result = await adminAPI.checkAllVMsHealth();

      // Refresh VM list to get updated statuses
      await fetchVMs();

      setSuccess(
        `Health check complete: ${result.healthy} healthy, ${result.unreachable} unreachable out of ${result.total} VMs`
      );
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to check health for all VMs');
    } finally {
      setCheckingAllHealth(false);
    }
  };

  // ===== Modal Functions =====

  const openCreateModal = () => {
    setFormData({
      name: '',
      ip_address: '',
      description: '',
      os_version: 'Windows Server 2022',
      winrm_port: 5985,
      admin_username: 'Administrator',
      admin_password: '',
    });
    setModalMode('create');
    setSelectedVm(null);
    setShowModal(true);
  };

  const openEditModal = (vm) => {
    setFormData({
      name: vm.name,
      ip_address: vm.ip_address,
      description: vm.description || '',
      os_version: vm.os_version || 'Windows Server 2022',
      winrm_port: vm.winrm_port || 5985,
      admin_username: vm.admin_username || 'Administrator',
      admin_password: '',
    });
    setModalMode('edit');
    setSelectedVm(vm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedVm(null);
    setError('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'winrm_port' ? parseInt(value) || 5985 : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (modalMode === 'create') {
        await adminAPI.createVM(formData);
        setSuccess('VM created successfully');
      } else {
        const updateData = { ...formData };
        if (!updateData.admin_password) {
          delete updateData.admin_password;
        }
        delete updateData.ip_address;

        await adminAPI.updateVM(selectedVm.id, updateData);
        setSuccess('VM updated successfully');
      }

      closeModal();
      fetchVMs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vm) => {
    if (!window.confirm(`Are you sure you want to delete "${vm.name}"? This will also remove all user mappings.`)) {
      return;
    }

    try {
      await adminAPI.deleteVM(vm.id);
      setSuccess(`VM "${vm.name}" deleted successfully`);
      fetchVMs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete VM');
    }
  };

  // ===== Render =====

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage VMs</h1>
          <p className="text-gray-500 mt-1">Add, edit, or remove virtual machines</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleCheckAllHealth}
            disabled={checkingAllHealth || loading}
          >
            {checkingAllHealth ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Activity size={18} />
                Check All Health
              </>
            )}
          </Button>
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={18} />
            Add VM
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search VMs by name, IP, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <Button variant="secondary" onClick={fetchVMs}>
          <RefreshCw size={18} />
        </Button>
      </div>

      {/* VMs Table */}
      <Card>
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 text-gray-600">Loading VMs...</p>
          </div>
        ) : vms.length === 0 ? (
          <div className="text-center py-8">
            <Server className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No VMs Found</h3>
            <p className="mt-2 text-gray-500">
              {searchTerm ? 'No VMs match your search.' : 'Get started by adding a VM.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">IP Address</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">OS</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Health</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vms.map((vm) => (
                  <tr key={vm.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-800">{vm.name}</p>
                        {vm.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">
                            {vm.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{vm.ip_address}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{vm.os_version}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${vm.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                        {vm.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <VMHealthBadge
                        status={vm.health_status || 'unknown'}
                        lastChecked={vm.last_health_check}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Health Check Button */}
                        <button
                          onClick={() => handleCheckHealth(vm)}
                          disabled={checkingHealth[vm.id]}
                          className={`p-2 rounded-lg transition-colors ${checkingHealth[vm.id]
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                          title="Check Health"
                        >
                          {checkingHealth[vm.id] ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Activity size={18} />
                          )}
                        </button>
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(vm)}
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={18} />
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(vm)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Health Check Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <span className="font-medium">Health Status:</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span>Healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span>Unreachable</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-400"></span>
          <span>Unknown</span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                {modalMode === 'create' ? 'Add New VM' : 'Edit VM'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <Input
                label="VM Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Production Server 1"
                required
              />

              {modalMode === 'create' && (
                <Input
                  label="IP Address"
                  name="ip_address"
                  value={formData.ip_address}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  required
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <Input
                label="OS Version"
                name="os_version"
                value={formData.os_version}
                onChange={handleChange}
                placeholder="Windows Server 2022"
              />

              <Input
                label="WinRM Port"
                name="winrm_port"
                type="number"
                value={formData.winrm_port}
                onChange={handleChange}
                placeholder="5985"
              />

              <Input
                label="Admin Username"
                name="admin_username"
                value={formData.admin_username}
                onChange={handleChange}
                placeholder="Administrator"
                required
              />

              <Input
                label={modalMode === 'create' ? 'Admin Password' : 'Admin Password (leave blank to keep current)'}
                name="admin_password"
                type="password"
                value={formData.admin_password}
                onChange={handleChange}
                placeholder="Enter admin password"
                required={modalMode === 'create'}
              />

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={submitting}>
                  <Save size={18} />
                  {modalMode === 'create' ? 'Create' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageVMs;