/**
 * My VMs Page
 * ===========
 * Shows VMs assigned to the current user, sorted by password expiry urgency.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { vmAPI } from '../services/api';
import { Card, Button, Alert } from '../components/ui';
import {
  Server,
  KeyRound,
  RefreshCw,
  CheckCircle,
  XCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Search,
  X,
} from 'lucide-react';

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

      // Sort by expiry: Urgent (low days) first, then unknown/null last
      vmList.sort((a, b) => {
        const daysA = a.days_until_expiry;
        const daysB = b.days_until_expiry;

        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1; // Put nulls at bottom
        if (daysB === null) return -1;
        return daysA - daysB; // Ascending order (5 days before 30 days)
      });

      setVms(vmList);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load VMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVMs();
  }, []);

  // Client-side search filter
  const filteredVMs = useMemo(() => {
    if (!searchTerm.trim()) return vms;
    const q = searchTerm.toLowerCase();
    return vms.filter(
      vm =>
        vm.name?.toLowerCase().includes(q) ||
        vm.ip_address?.toLowerCase().includes(q)
    );
  }, [vms, searchTerm]);

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'unhealthy':
      case 'unreachable':
        return <XCircle className="text-red-500" size={20} />;
      default:
        return <HelpCircle className="text-gray-400" size={20} />;
    }
  };

  // Format an expiry date string for tooltip
  const formatExpiryDate = (days, isoDate) => {
    if (isoDate) {
      return `Expires on ${new Date(isoDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
    if (days === null || days === undefined) return 'Password never expires';
    const d = new Date(Date.now() + days * 86400000);
    return `Expires on ${d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  };

  // Helper to render expiry badge with tooltip
  const getExpiryBadge = (days, expiryDate) => {
    const tooltip = formatExpiryDate(days, expiryDate);

    if (days === null || days === undefined) {
      return (
        <div title={tooltip} className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
          <Shield size={14} />
          <span>Password Never Expires</span>
        </div>
      );
    }

    if (days <= 7) {
      return (
        <div title={tooltip} className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium border border-red-200">
          <ShieldAlert size={14} />
          <span>Expires in {days} days</span>
        </div>
      );
    }

    if (days <= 14) {
      return (
        <div title={tooltip} className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium border border-yellow-200">
          <Shield size={14} />
          <span>Expires in {days} days</span>
        </div>
      );
    }

    return (
      <div title={tooltip} className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium border border-green-200">
        <ShieldCheck size={14} />
        <span>Expires in {days} days</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading your VMs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Virtual Machines</h1>
          <p className="text-gray-500 mt-1">
            VMs assigned to you for password management
          </p>
        </div>
        <Button variant="secondary" onClick={fetchVMs}>
          <RefreshCw size={18} />
          Refresh
        </Button>
      </div>

      {/* ── Search Bar ── */}
      {!loading && vms.length > 0 && (
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name or IP address…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {error && (
        <Alert variant="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* VMs Grid */}
      {vms.length === 0 ? (
        // No VMs at all
        <Card className="text-center py-12">
          <Server className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No VMs Assigned</h3>
          <p className="mt-2 text-gray-500">
            You don't have any VMs assigned to you yet.
            <br />
            Please contact your administrator.
          </p>
        </Card>
      ) : filteredVMs.length === 0 ? (
        // VMs exist but none match the filter
        <Card className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Results Found</h3>
          <p className="mt-2 text-gray-500 text-sm">
            No VMs match your current search or filter.
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-4 text-sm text-primary-600 hover:underline font-medium"
          >
            Clear search
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVMs.map((vm) => (
            <Card key={vm.id} className="hover:shadow-lg transition-shadow">
              {/* VM Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Server className="text-primary-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{vm.name}</h3>
                    <p className="text-sm text-gray-500">{vm.ip_address}</p>
                  </div>
                </div>
                {getHealthIcon(vm.health_status)}
              </div>

              {/* VM Details */}
              <div className="space-y-3 mb-4">
                {vm.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{vm.description}</p>
                )}

                {/* Username Row */}
                <div className="flex items-center justify-between text-sm py-1 border-b border-gray-100">
                  <span className="text-gray-500">Your Username:</span>
                  <span className="font-medium text-gray-800">{vm.local_username}</span>
                </div>

                {/* Expiry Row */}
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-500">Password Expiry:</span>
                  {getExpiryBadge(vm.days_until_expiry, vm.password_expiry_date)}
                </div>

                {/* Health Check Time */}
                {vm.last_health_check && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                    <Clock size={12} />
                    Checked: {new Date(vm.last_health_check).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t">
                {vm.can_reset_password ? (
                  <Link to={`/vm-password-reset?vm=${vm.id}`}>
                    <Button variant="primary" className="w-full">
                      <KeyRound size={18} />
                      Reset Password
                    </Button>
                  </Link>
                ) : (
                  <Button variant="secondary" className="w-full" disabled>
                    <KeyRound size={18} />
                    Password Reset Disabled
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {vms.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Total: {vms.length} VM{vms.length !== 1 ? 's' : ''} assigned to you
        </div>
      )}
    </div>
  );
};

export default MyVMs;