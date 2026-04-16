/**
 * Admin: Manage Remote Users Page
 * ================================
 * Create, disable, enable, unlock, delete local user accounts
 * on remote Windows VMs via WinRM.
 */

import { useState, useEffect, useRef } from 'react';
import { adminAPI, remoteUserAPI } from '../../services/api';
import { Card, Button, Input, Alert } from '../../components/ui';
import VMHealthBadge from '../../components/VMHealthBadge';
import {
  UserPlus,
  UserX,
  UserCheck,
  Unlock,
  Trash2,
  Users,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Shield,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Key,
} from 'lucide-react';

// ===== SHARED VM SELECTOR COMPONENT (OUTSIDE TO PERSIST STATE) =====
const VMSelector = ({
  selected,
  setSelected,
  vms,
  loadingVMs,
  toggleVM,
  selectAllVMs,
  deselectAllVMs,
  label = 'Select Servers'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter VMs based on search term
  const filteredVMs = vms.filter(vm =>
    vm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vm.ip_address.includes(searchTerm)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>

      {/* Dropdown Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl shadow-sm transition-all duration-200 text-left hover:border-primary-400 focus:ring-2 focus:ring-primary-500/20 ${isOpen ? 'border-primary-500 ring-2 ring-primary-500/10' : 'border-gray-300'
          }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Server size={18} className={selected.length > 0 ? 'text-primary-500' : 'text-gray-400'} />
          <span className={`truncate text-sm font-medium ${selected.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
            {selected.length === 0
              ? 'Select Target Servers'
              : `${selected.length} Server${selected.length > 1 ? 's' : ''} Selected`
            }
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Target Selection</span>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => selectAllVMs(setSelected)}
                  className="text-[11px] text-primary-600 hover:text-primary-700 font-bold uppercase transition-colors"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => deselectAllVMs(setSelected)}
                  className="text-[11px] text-gray-400 hover:text-gray-600 font-bold uppercase transition-colors"
                >
                  None
                </button>
              </div>
            </div>

            {/* Search Bar within Dropdown */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Filter by name or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {loadingVMs ? (
              <div className="p-8 text-center text-gray-500">
                <Loader2 size={24} className="animate-spin mx-auto mb-2 text-primary-500" />
                <span className="text-xs font-semibold">Scanning Network...</span>
              </div>
            ) : filteredVMs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <span className="text-sm italic">No matching servers found</span>
              </div>
            ) : (
              filteredVMs.map(vm => (
                <div
                  key={vm.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVM(vm.id, setSelected);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl mb-1 last:mb-0 transition-all ${selected.includes(vm.id)
                    ? 'bg-primary-50/50 text-primary-700'
                    : 'hover:bg-gray-50 text-gray-700'
                    }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selected.includes(vm.id)
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white border-gray-300'
                    }`}>
                    {selected.includes(vm.id) && <Check size={14} strokeWidth={4} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm truncate">{vm.name}</span>
                      <VMHealthBadge status={vm.health_status || 'unknown'} />
                    </div>
                    <span className="text-[10px] font-mono opacity-60 uppercase">{vm.ip_address}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-between items-center text-[11px] font-medium text-gray-400">
            <span>Showing {filteredVMs.length} Servers</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-1 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {vms.filter(v => selected.includes(v.id)).slice(0, 5).map(v => (
            <span key={v.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary-100/50 text-primary-700 rounded-md text-[10px] font-bold">
              {v.name}
              <button
                type="button"
                onClick={() => toggleVM(v.id, setSelected)}
                className="hover:text-primary-900"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {selected.length > 5 && (
            <span className="text-[10px] text-gray-400 font-bold self-center">+ {selected.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
};

const ManageRemoteUsers = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage' | 'list'

  // VM data
  const [vms, setVms] = useState([]);
  const [loadingVMs, setLoadingVMs] = useState(true);

  // Alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ===== CREATE TAB STATE =====
  const [createForm, setCreateForm] = useState({
    username: '',
    full_name: '',
    password: '',
    description: '',
    user_type: 'standard',
    must_change_password: false,
    enable_rdp: true,
  });
  const [selectedVMs, setSelectedVMs] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // ===== MANAGE TAB STATE =====
  const [manageUsername, setManageUsername] = useState('');
  const [manageAction, setManageAction] = useState('disable');
  const [manageVMs, setManageVMs] = useState([]);
  const [managing, setManaging] = useState(false);

  // ===== LIST TAB STATE =====
  const [listVMId, setListVMId] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [listingUsers, setListingUsers] = useState(false);
  const [listVMInfo, setListVMInfo] = useState(null);

  const [results, setResults] = useState(null);

  // ===== RESET PASSWORD STATE =====
  const [bulkUsername, setBulkUsername] = useState('');
  const [bulkPassword, setBulkPassword] = useState('');
  const [selectedVMsReset, setSelectedVMsReset] = useState([]); // Selected VMs for reset
  const [bulkResetting, setBulkResetting] = useState(false);
  const [showBulkPassword, setShowBulkPassword] = useState(false);
  const [copiedBulkPassword, setCopiedBulkPassword] = useState(false);

  // ===== FETCH VMs =====
  useEffect(() => {
    fetchVMs();
  }, []);

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchVMs = async () => {
    setLoadingVMs(true);
    try {
      const response = await adminAPI.getVMs({ limit: 200 });
      const vmList = (response.vms || [])
        .filter(v => v.is_active)
        .sort((a, b) => a.name.localeCompare(b.name));
      setVms(vmList);
    } catch (err) {
      setError('Failed to load VMs');
    } finally {
      setLoadingVMs(false);
    }
  };


  // ===== CREATE HANDLERS =====
  const handleGeneratePassword = async () => {
    try {
      const response = await remoteUserAPI.generatePassword(16);
      setCreateForm(prev => ({ ...prev, password: response.password }));
      setShowPassword(true);
    } catch (err) {
      setError('Failed to generate password');
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(createForm.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const toggleVM = (vmId, listSetter) => {
    listSetter(prev =>
      prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId]
    );
  };

  const selectAllVMs = (listSetter) => {
    listSetter(vms.map(vm => vm.id));
  };

  const deselectAllVMs = (listSetter) => {
    listSetter([]);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (selectedVMs.length === 0) {
      setError('Please select at least one server');
      return;
    }
    if (!createForm.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!createForm.password) {
      setError('Password is required');
      return;
    }

    setCreating(true);
    setError('');
    setResults(null);

    try {
      const response = await remoteUserAPI.createUser({
        ...createForm,
        vm_ids: selectedVMs,
      });
      setResults(response);

      if (response.failed === 0) {
        setSuccess(`User '${createForm.username}' created on ${response.successful} server(s)`);
      } else {
        setError(`User created on ${response.successful}/${response.total_vms} servers (${response.failed} failed)`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // ===== MANAGE HANDLERS =====
  const handleManageUser = async () => {
    if (manageVMs.length === 0) {
      setError('Please select at least one server');
      return;
    }
    if (!manageUsername.trim()) {
      setError('Username is required');
      return;
    }

    // Confirmation for delete
    if (manageAction === 'delete') {
      const confirmed = window.confirm(
        `Are you sure you want to DELETE user '${manageUsername}' from ${manageVMs.length} server(s)?\n\nThis will also remove any Keystone user-VM mappings.`
      );
      if (!confirmed) return;
    }

    setManaging(true);
    setError('');
    setResults(null);

    try {
      const apiMap = {
        disable: remoteUserAPI.disableUser,
        enable: remoteUserAPI.enableUser,
        unlock: remoteUserAPI.unlockUser,
        delete: remoteUserAPI.deleteUser,
      };

      const response = await apiMap[manageAction]({
        username: manageUsername,
        vm_ids: manageVMs,
      });
      setResults(response);

      const actionPast = {
        disable: 'disabled',
        enable: 'enabled',
        unlock: 'unlocked',
        delete: 'deleted',
      };

      if (response.failed === 0) {
        setSuccess(`User '${manageUsername}' ${actionPast[manageAction]} on ${response.successful} server(s)`);
      } else {
        setError(`${actionPast[manageAction]} on ${response.successful}/${response.total_vms} servers (${response.failed} failed)`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Operation failed');
    } finally {
      setManaging(false);
    }
  };

  // ===== LIST HANDLERS =====
  const handleListUsers = async () => {
    if (!listVMId) {
      setError('Please select a server');
      return;
    }

    setListingUsers(true);
    setError('');
    setRemoteUsers([]);

    try {
      const response = await remoteUserAPI.listUsers(listVMId);
      setRemoteUsers(response.users || []);
      setListVMInfo({ name: response.vm_name, ip: response.ip_address });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to list users');
    } finally {
      setListingUsers(false);
    }
  };

  // ===== BULK RESET HANDLERS =====
  const handleGenerateBulkPassword = async () => {
    try {
      const response = await remoteUserAPI.generatePassword(16);
      setBulkPassword(response.password);
      setShowBulkPassword(true);
    } catch (err) {
      setError('Failed to generate password');
    }
  };

  const handleCopyBulkPassword = () => {
    navigator.clipboard.writeText(bulkPassword);
    setCopiedBulkPassword(true);
    setTimeout(() => setCopiedBulkPassword(false), 2000);
  };

  const handleBulkReset = async (e) => {
    e.preventDefault();
    if (!bulkUsername.trim()) {
      setError('Please enter a remote username');
      return;
    }
    if (!bulkPassword.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (selectedVMsReset.length === 0) {
      setError('Please select at least one target server');
      return;
    }

    const confirmed = window.confirm(
      `Confirm Password Reset for '${bulkUsername}' on ${selectedVMsReset.length} selected server(s)?`
    );
    if (!confirmed) return;

    setBulkResetting(true);
    setResults(null);
    setError('');
    setSuccess('');

    try {
      const response = await remoteUserAPI.bulkPasswordReset({
        username: bulkUsername,
        new_password: bulkPassword,
        vm_ids: selectedVMsReset
      });

      if (response.error) {
        setError(response.error);
        setResults(response);
      } else if (response.failed === 0 && response.successful > 0) {
        setSuccess(`Password reset successful for '${bulkUsername}' on ${response.successful} server(s)`);
        setResults(response);
        setBulkPassword('');
      } else if (response.successful === 0 && response.failed === 0) {
        setError(`No servers were targeted. Check the username or select servers manually.`);
        setResults(response);
      } else {
        setError(`Password reset completed with ${response.failed} failure(s)`);
        setResults(response);
      }
    } catch (err) {
      setError('Failed to execute bulk password reset');
      console.error(err);
    } finally {
      setBulkResetting(false);
    }
  };

  // ===== RESULTS COMPONENT =====
  const ResultsPanel = () => {
    if (!results) return null;

    return (
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} />
          Results — {results.action.toUpperCase()} '{results.username}'
        </h3>

        {/* Summary */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-green-700">{results.successful}</p>
            <p className="text-xs text-green-600">Successful</p>
          </div>
          <div className="flex-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-red-700">{results.failed}</p>
            <p className="text-xs text-red-600">Failed</p>
          </div>
        </div>

        {/* Global Error message if present */}
        {results.error && !results.results.length && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {results.error}
          </div>
        )}

        {/* Per-VM Results */}
        <div className="space-y-2 mt-4">
          {results.results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${r.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
                }`}
            >
              {r.success ? (
                <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
              ) : (
                <XCircle size={16} className="text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{r.vm_name}</span>
                <span className="text-gray-500 ml-2 font-mono text-xs">({r.ip_address})</span>
              </div>
              <span className={`text-xs ${r.success ? 'text-green-700' : 'text-red-700'}`}>
                {r.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== TABS =====
  const tabs = [
    { id: 'create', label: 'Create User', icon: UserPlus },
    { id: 'manage', label: 'Manage User', icon: UserCheck },
    { id: 'bulk-reset', label: 'Reset Password', icon: Key },
    { id: 'list', label: 'List Users', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Remote User Management</h1>
        <p className="text-gray-500 mt-1">
          Create and manage local user accounts on your remote Windows servers
        </p>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setResults(null);
                setError('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =============================== */}
      {/* CREATE USER TAB                  */}
      {/* =============================== */}
      {activeTab === 'create' && (
        <Card>
          <form onSubmit={handleCreateUser} className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <UserPlus size={20} className="text-primary-600" />
              Create Remote User
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column — Form Fields */}
              <div className="space-y-4">
                <Input
                  label="Username *"
                  value={createForm.username}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="rahul.sharma"
                  required
                />

                <Input
                  label="Full Name *"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Rahul Sharma"
                  required
                />

                {/* Password Field with Generate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.password}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter or generate a password"
                        required
                        className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                          title={showPassword ? 'Hide' : 'Show'}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        {createForm.password && (
                          <button
                            type="button"
                            onClick={handleCopyPassword}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                            title="Copy"
                          >
                            {copiedPassword ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                    >
                      🔄 Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional: e.g., DevOps team member"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>

                {/* User Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Type *</label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${createForm.user_type === 'standard'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                      <input
                        type="radio"
                        name="user_type"
                        value="standard"
                        checked={createForm.user_type === 'standard'}
                        onChange={() => setCreateForm(prev => ({ ...prev, user_type: 'standard' }))}
                        className="sr-only"
                      />
                      <Shield size={18} />
                      <span className="font-medium text-sm">Standard User</span>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${createForm.user_type === 'administrator'
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}>
                      <input
                        type="radio"
                        name="user_type"
                        value="administrator"
                        checked={createForm.user_type === 'administrator'}
                        onChange={() => setCreateForm(prev => ({ ...prev, user_type: 'administrator' }))}
                        className="sr-only"
                      />
                      <ShieldAlert size={18} />
                      <span className="font-medium text-sm">Administrator</span>
                    </label>
                  </div>
                </div>

                {/* Must Change Password */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.must_change_password}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, must_change_password: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Must change password at next logon</span>
                </label>
                
                {/* Enable RDP Access */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.enable_rdp}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, enable_rdp: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Enable RDP access</span>
                </label>
              </div>

              {/* Right Column — VM Selector */}
              <div>
                <VMSelector
                  selected={selectedVMs}
                  setSelected={setSelectedVMs}
                  vms={vms}
                  loadingVMs={loadingVMs}
                  toggleVM={toggleVM}
                  selectAllVMs={selectAllVMs}
                  deselectAllVMs={deselectAllVMs}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button type="submit" variant="primary" loading={creating} disabled={creating}>
                <UserPlus size={18} />
                {creating ? 'Creating...' : `Create User on ${selectedVMs.length} Server${selectedVMs.length !== 1 ? 's' : ''}`}
              </Button>
            </div>

            <ResultsPanel />
          </form>
        </Card>
      )}

      {/* =============================== */}
      {/* MANAGE USER TAB                  */}
      {/* =============================== */}
      {activeTab === 'manage' && (
        <Card>
          <div className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <UserCheck size={20} className="text-primary-600" />
              Manage Remote User
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left — Form */}
              <div className="space-y-4">
                <Input
                  label="Username *"
                  value={manageUsername}
                  onChange={(e) => setManageUsername(e.target.value)}
                  placeholder="rahul.sharma"
                />

                {/* Action Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Action *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'disable', label: 'Disable', icon: UserX, color: 'orange' },
                      { id: 'enable', label: 'Enable', icon: UserCheck, color: 'green' },
                      { id: 'unlock', label: 'Unlock', icon: Unlock, color: 'blue' },
                      { id: 'delete', label: 'Delete', icon: Trash2, color: 'red' },
                    ].map(action => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => setManageAction(action.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${manageAction === action.id
                          ? action.color === 'red'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : action.color === 'orange'
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : action.color === 'green'
                                ? 'border-green-500 bg-green-50 text-green-700'
                                : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                      >
                        <action.icon size={16} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {manageAction === 'delete' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    ⚠️ <strong>Warning:</strong> Deleting a user will permanently remove their account from the server and clean up any Keystone mappings.
                  </div>
                )}
              </div>

              {/* Right — VM Selector */}
              <VMSelector
                selected={manageVMs}
                setSelected={setManageVMs}
                vms={vms}
                loadingVMs={loadingVMs}
                toggleVM={toggleVM}
                selectAllVMs={selectAllVMs}
                deselectAllVMs={deselectAllVMs}
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <Button
                variant={manageAction === 'delete' ? 'danger' : 'primary'}
                onClick={handleManageUser}
                loading={managing}
                disabled={managing}
              >
                {manageAction === 'disable' && <UserX size={18} />}
                {manageAction === 'enable' && <UserCheck size={18} />}
                {manageAction === 'unlock' && <Unlock size={18} />}
                {manageAction === 'delete' && <Trash2 size={18} />}
                {managing ? 'Processing...' : `${manageAction.charAt(0).toUpperCase() + manageAction.slice(1)} User on ${manageVMs.length} Server${manageVMs.length !== 1 ? 's' : ''}`}
              </Button>
            </div>

            <ResultsPanel />
          </div>
        </Card>
      )}

      {/* =============================== */}
      {/* RESET PASSWORD TAB                */}
      {/* =============================== */}
      {activeTab === 'bulk-reset' && (
        <Card className="bg-white/50 backdrop-blur-sm border-gray-200 shadow-sm">
          <form onSubmit={handleBulkReset} className="p-8 max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-3">
                <Key size={28} className="text-primary-600" />
                Reset User Password
              </h2>
              <p className="text-gray-500">Update a remote user's credentials across targeted servers</p>
            </div>

            <div className="space-y-6">
              {/* Target Servers */}
              <VMSelector
                vms={vms}
                selected={selectedVMsReset}
                setSelected={setSelectedVMsReset}
                loadingVMs={loadingVMs}
                toggleVM={toggleVM}
                selectAllVMs={selectAllVMs}
                deselectAllVMs={deselectAllVMs}
                label="Select Target Servers *"
              />

              {/* Target User */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Remote Username</label>
                <div className="relative">
                  <Input
                    value={bulkUsername}
                    onChange={(e) => {
                      setBulkUsername(e.target.value);
                      setResults(null);
                    }}
                    placeholder="Enter remote username (e.g. rahul.sharma)"
                    required
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">New Remote Password</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showBulkPassword ? 'text' : 'password'}
                      value={bulkPassword}
                      onChange={(e) => setBulkPassword(e.target.value)}
                      placeholder="Enter or generate password"
                      required
                      className="w-full pl-4 pr-20 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowBulkPassword(!showBulkPassword)}
                        className="p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        {showBulkPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {bulkPassword && (
                        <button
                          type="button"
                          onClick={handleCopyBulkPassword}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                          {copiedBulkPassword ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBulkPassword}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Auto
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-4 rounded-xl text-base font-bold shadow-lg shadow-primary-200 transition-all active:scale-[0.98]"
                loading={bulkResetting} 
                disabled={bulkResetting || !bulkUsername || !bulkPassword}
              >
                {bulkResetting ? 'Resetting on all servers...' : 'Reset Password'}
              </Button>
            </div>

            <ResultsPanel />
          </form>
        </Card>
      )}

      {/* =============================== */}
      {/* LIST USERS TAB                   */}
      {/* =============================== */}
      {activeTab === 'list' && (
        <Card>
          <div className="p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Users size={20} className="text-primary-600" />
              List Remote Users
            </h2>

            {/* VM Dropdown */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Server</label>
                <select
                  value={listVMId}
                  onChange={(e) => {
                    setListVMId(e.target.value);
                    setRemoteUsers([]);
                    setListVMInfo(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                >
                  <option value="">-- Choose a server --</option>
                  {vms.map(vm => (
                    <option key={vm.id} value={vm.id}>
                      {vm.name} ({vm.ip_address})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="primary"
                onClick={handleListUsers}
                loading={listingUsers}
                disabled={!listVMId || listingUsers}
              >
                <Users size={18} />
                {listingUsers ? 'Loading...' : 'List Users'}
              </Button>
            </div>

            {/* Users Table */}
            {remoteUsers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">{remoteUsers.length} users</span> found on{' '}
                    <span className="font-semibold">{listVMInfo?.name}</span>{' '}
                    <span className="text-gray-400 font-mono text-xs">({listVMInfo?.ip})</span>
                  </p>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Username</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Full Name</th>
                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Status</th>
                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Locked</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Description</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Last Logon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remoteUsers.map((user, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-mono font-medium text-gray-800">{user.name}</td>
                          <td className="py-2.5 px-3 text-gray-700">{user.full_name || '—'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.enabled
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                              }`}>
                              {user.enabled ? (
                                <><CheckCircle2 size={12} /> Enabled</>
                              ) : (
                                <><XCircle size={12} /> Disabled</>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {user.locked_out ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                🔒 Locked
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 truncate max-w-[200px]">
                            {user.description || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 text-xs">
                            {user.last_logon
                              ? new Date(user.last_logon).toLocaleString()
                              : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!listingUsers && remoteUsers.length === 0 && listVMId && listVMInfo && (
              <div className="text-center py-8 text-gray-500">
                <Users size={32} className="mx-auto mb-2 text-gray-400" />
                <p>No users found or failed to connect.</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default ManageRemoteUsers;
