/**
 * Admin: Manage VMs — Shadcn UI Redesign
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Server, Plus, Edit, Trash2, Activity, Loader2, Save, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ManageVMs = () => {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkingHealth, setCheckingHealth] = useState({});
  const [checkingAllHealth, setCheckingAllHealth] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedVm, setSelectedVm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', ip_address: '', description: '', os_version: 'Windows Server 2022',
    winrm_port: 5985, admin_username: 'Administrator', admin_password: '',
  });

  const fetchVMs = async () => {
    setLoading(true); setError('');
    try {
      const response = await adminAPI.getVMs({});
      setVms((response.vms || []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) { setError(err.response?.data?.detail || 'Failed to load VMs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVMs(); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); } }, [success]);

  const handleCheckHealth = async (vm) => {
    setCheckingHealth(prev => ({ ...prev, [vm.id]: true })); setError('');
    try {
      const result = await adminAPI.checkVMHealth(vm.id);
      setVms(prev => prev.map(v => v.id === vm.id ? { ...v, health_status: result.health_status, last_health_check: result.last_health_check } : v));
      setSuccess(`${vm.name}: ${result.health_status}`);
    } catch (err) { setError(err.response?.data?.detail || `Failed to check ${vm.name}`); }
    finally { setCheckingHealth(prev => ({ ...prev, [vm.id]: false })); }
  };

  const handleCheckAllHealth = async () => {
    setCheckingAllHealth(true); setError(''); setSuccess('');
    try {
      const result = await adminAPI.checkAllVMsHealth();
      await fetchVMs();
      setSuccess(`Health check: ${result.healthy} healthy, ${result.unreachable} unreachable / ${result.total}`);
    } catch (err) { setError(err.response?.data?.detail || 'Health check failed'); }
    finally { setCheckingAllHealth(false); }
  };

  const openCreateModal = () => {
    setFormData({ name: '', ip_address: '', description: '', os_version: 'Windows Server 2022', winrm_port: 5985, admin_username: 'Administrator', admin_password: '' });
    setModalMode('create'); setSelectedVm(null); setShowModal(true);
  };

  const openEditModal = (vm) => {
    setFormData({ name: vm.name, ip_address: vm.ip_address, description: vm.description || '', os_version: vm.os_version || 'Windows Server 2022', winrm_port: vm.winrm_port || 5985, admin_username: vm.admin_username || 'Administrator', admin_password: '' });
    setModalMode('edit'); setSelectedVm(vm); setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'winrm_port' ? parseInt(value) || 5985 : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      if (modalMode === 'create') { await adminAPI.createVM(formData); setSuccess('VM created'); }
      else {
        const d = { ...formData }; if (!d.admin_password) delete d.admin_password; delete d.ip_address;
        await adminAPI.updateVM(selectedVm.id, d); setSuccess('VM updated');
      }
      setShowModal(false); fetchVMs();
    } catch (err) { setError(err.response?.data?.detail || 'Operation failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (vm) => {
    if (!window.confirm(`Delete "${vm.name}"? This removes all user mappings.`)) return;
    try { await adminAPI.deleteVM(vm.id); setSuccess(`"${vm.name}" deleted`); fetchVMs(); }
    catch (err) { setError(err.response?.data?.detail || 'Delete failed'); }
  };

  const columns = [
    {
      header: 'Name', accessorKey: 'name',
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          {row.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{row.description}</p>}
        </div>
      ),
    },
    { header: 'IP Address', accessorKey: 'ip_address', cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.ip_address}</span> },
    { header: 'OS', accessorKey: 'os_version', cell: (row) => <span className="text-xs text-muted-foreground">{row.os_version}</span> },
    { header: 'Status', cell: (row) => <StatusBadge status={row.is_active ? 'active' : 'disabled'} /> },
    {
      header: 'Health', cell: (row) => (
        <StatusBadge status={row.health_status === 'healthy' ? 'online' : row.health_status === 'unreachable' ? 'offline' : 'unknown'}
          label={row.health_status || 'Unknown'} />
      ),
    },
    {
      header: 'Actions', className: 'text-right', cellClassName: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => handleCheckHealth(row)} disabled={checkingHealth[row.id]}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors disabled:opacity-50" title="Check Health">
            {checkingHealth[row.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          </button>
          <Link to={`/admin/vms/${row.id}/health`} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors" title="Health Stats">
            <BarChart3 className="h-4 w-4" />
          </Link>
          <button onClick={() => openEditModal(row)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors" title="Edit">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Manage VMs</h1>
          <p className="text-sm text-muted-foreground mt-1">Add, edit, or remove virtual machines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCheckAllHealth} disabled={checkingAllHealth || loading}>
            {checkingAllHealth ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking...</> : <><Activity className="h-4 w-4" /> Check All</>}
          </Button>
          <Button onClick={openCreateModal}><Plus className="h-4 w-4" /> Add VM</Button>
        </div>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <DataTable columns={columns} data={vms} loading={loading} searchPlaceholder="Search VMs..."
        searchKeys={['name', 'ip_address', 'description']} emptyIcon={Server} emptyTitle="No VMs Found" emptyDescription="Get started by adding a VM." />

      {/* Add/Edit Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">{modalMode === 'create' ? 'Add New VM' : 'Edit VM'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="VM Name" name="name" value={formData.name} onChange={handleChange} placeholder="e.g. AppServer-01" required />
              {modalMode === 'create' && <Input label="IP Address" name="ip_address" value={formData.ip_address} onChange={handleChange} placeholder="192.168.1.100" required />}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Optional physical location, purpose, or note..." rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none transition-colors" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="OS Version" name="os_version" value={formData.os_version} onChange={handleChange} placeholder="e.g. Windows Server 2022" />
              <Input label="WinRM Port (Default: 5985)" name="winrm_port" type="number" value={formData.winrm_port} onChange={handleChange} />
            </div>

            <div className="border-t border-border pt-4">
               <h4 className="text-sm font-medium mb-3 text-muted-foreground tracking-tight">Admin Credentials</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <Input label="Username" name="admin_username" value={formData.admin_username} onChange={handleChange} required />
                 <Input label={modalMode === 'create' ? 'Password' : 'Password (leave blank for current)'} name="admin_password" type="password" value={formData.admin_password} onChange={handleChange} required={modalMode === 'create'} />
               </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>{modalMode === 'create' ? 'Create Instance' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageVMs;