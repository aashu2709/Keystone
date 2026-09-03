/**
 * Admin: Manage Mappings — Shadcn UI Redesign
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import DataTable from '@/components/DataTable';
import { Link as LinkIcon, Plus, Trash2, RefreshCw, User, Server, Save } from 'lucide-react';

const ManageMappings = () => {
  const [mappings, setMappings] = useState([]);
  const [users, setUsers] = useState([]);
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '', vm_id: '', local_username: '', can_reset_password: true, can_view_history: false, notes: '',
  });

  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const [mappingsRes, usersRes, vmsRes] = await Promise.all([adminAPI.getMappings(), adminAPI.getUsers(), adminAPI.getVMs()]);
      setMappings(mappingsRes.mappings || []); setUsers(usersRes.users || []); setVms(vmsRes.vms || []);
    } catch (err) { setError(err.response?.data?.detail || 'Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreateModal = () => {
    setFormData({ user_id: '', vm_id: '', local_username: '', can_reset_password: true, can_view_history: false, notes: '' });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await adminAPI.createMapping(formData);
      setSuccess('Mapping created'); setShowModal(false); fetchData();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create mapping'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (mapping) => {
    if (!window.confirm(`Remove access for "${mapping.user_username}" to "${mapping.vm_name}"?`)) return;
    try { await adminAPI.deleteMapping(mapping.id); setSuccess('Mapping deleted'); fetchData(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to delete'); }
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const checkboxClass = "rounded border-input text-primary focus:ring-ring h-4 w-4";

  const columns = [
    {
      header: 'User', accessorKey: 'user_full_name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-foreground">{row.user_full_name}</p>
            <p className="text-xs text-muted-foreground">@{row.user_username}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'VM', accessorKey: 'vm_name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium text-foreground">{row.vm_name}</p>
            <p className="text-xs text-muted-foreground">{row.vm_ip_address}</p>
          </div>
        </div>
      ),
    },
    { header: 'VM Username', accessorKey: 'local_username', cell: (row) => <span className="text-xs font-mono text-muted-foreground">{row.local_username}</span> },
    {
      header: 'Permissions',
      cell: (row) => (
        <div className="flex gap-1.5">
          {row.can_reset_password && <Badge variant="success">Reset</Badge>}
          {row.can_view_history && <Badge variant="info">History</Badge>}
        </div>
      ),
    },
    {
      header: '', className: 'text-right', cellClassName: 'text-right',
      cell: (row) => (
        <button onClick={() => handleDelete(row)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User-VM Mappings</h1>
          <p className="text-sm text-muted-foreground mt-1">Assign users to VMs for password management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreateModal}><Plus className="h-4 w-4" /> Add Mapping</Button>
        </div>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <DataTable columns={columns} data={mappings} loading={loading} searchPlaceholder="Search mappings..."
        searchKeys={['user_full_name', 'user_username', 'vm_name', 'local_username']}
        emptyIcon={LinkIcon} emptyTitle="No Mappings" emptyDescription="Create a mapping to assign a user to a VM." />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Mapping</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">User <span className="text-destructive">*</span></label>
              <select name="user_id" value={formData.user_id} onChange={handleChange} className={selectClass} required>
                <option value="">— Select User —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name} (@{u.username})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">VM <span className="text-destructive">*</span></label>
              <select name="vm_id" value={formData.vm_id} onChange={handleChange} className={selectClass} required>
                <option value="">— Select VM —</option>
                {vms.map(v => <option key={v.id} value={v.id}>{v.name} ({v.ip_address})</option>)}
              </select>
            </div>
            <Input label="VM Username" name="local_username" value={formData.local_username} onChange={handleChange} placeholder="e.g., john_prod" required />
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Permissions</label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="can_reset_password" checked={formData.can_reset_password} onChange={handleChange} className={checkboxClass} />
                <span className="text-sm text-foreground">Can reset password</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="can_view_history" checked={formData.can_view_history} onChange={handleChange} className={checkboxClass} />
                <span className="text-sm text-foreground">Can view password history</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Optional notes..." rows={2}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}><Save className="h-4 w-4" /> Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageMappings;