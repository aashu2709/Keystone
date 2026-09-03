/**
 * My VMs Page — Shadcn UI Redesign
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { vmAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import StatusBadge from '@/components/StatusBadge';
import { Server, KeyRound, RefreshCw, Clock, Search, X } from 'lucide-react';

const MyVMs = () => {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchVMs = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vmAPI.getMyVMs();
      let vmList = response.vms || [];
      vmList.sort((a, b) => {
        const dA = a.days_until_expiry, dB = b.days_until_expiry;
        if (dA === null && dB === null) return 0;
        if (dA === null) return 1;
        if (dB === null) return -1;
        return dA - dB;
      });
      setVms(vmList);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load VMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVMs(); }, []);

  const filteredVMs = useMemo(() => {
    if (!searchTerm.trim()) return vms;
    const q = searchTerm.toLowerCase();
    return vms.filter(vm => vm.name?.toLowerCase().includes(q) || vm.ip_address?.toLowerCase().includes(q));
  }, [vms, searchTerm]);

  const getExpiryBadge = (days) => {
    if (days === null || days === undefined) return <Badge variant="secondary">Never Expires</Badge>;
    if (days <= 7) return <Badge variant="danger">{days} days left</Badge>;
    if (days <= 14) return <Badge variant="warning">{days} days left</Badge>;
    return <Badge variant="success">{days} days left</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Virtual Machines</h1>
          <p className="text-sm text-muted-foreground mt-1">VMs assigned to you for password management</p>
        </div>
        <Button variant="outline" onClick={fetchVMs}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Search */}
      {vms.length > 0 && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or IP..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Grid */}
      {vms.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No VMs Assigned</h3>
            <p className="text-sm text-muted-foreground mt-1">You don't have any VMs assigned yet. Contact your administrator.</p>
          </CardContent>
        </Card>
      ) : filteredVMs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Results</h3>
            <p className="text-sm text-muted-foreground mt-1">No VMs match your search.</p>
            <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="mt-3">Clear search</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVMs.map((vm) => (
            <Card key={vm.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{vm.name}</h3>
                      <p className="text-xs text-muted-foreground">{vm.ip_address}</p>
                    </div>
                  </div>
                  <StatusBadge status={vm.health_status === 'healthy' ? 'online' : vm.health_status === 'unreachable' || vm.health_status === 'unhealthy' ? 'offline' : 'unknown'} />
                </div>

                {/* Details */}
                <div className="space-y-2.5 mb-4">
                  {vm.description && <p className="text-xs text-muted-foreground line-clamp-2">{vm.description}</p>}
                  <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium text-foreground">{vm.local_username}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-muted-foreground">Password</span>
                    {getExpiryBadge(vm.days_until_expiry)}
                  </div>
                  {vm.last_health_check && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
                      <Clock className="h-3 w-3" />
                      Checked: {new Date(vm.last_health_check).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="pt-3 border-t border-border">
                  {vm.can_reset_password ? (
                    <Link to={`/vm-password-reset?vm=${vm.id}`}>
                      <Button className="w-full" size="sm">
                        <KeyRound className="h-4 w-4" />
                        Reset Password
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" className="w-full" size="sm" disabled>
                      <KeyRound className="h-4 w-4" />
                      Password Reset Disabled
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {vms.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing {filteredVMs.length} of {vms.length} VM{vms.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default MyVMs;