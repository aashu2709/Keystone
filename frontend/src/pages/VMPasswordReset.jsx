/**
 * VM Password Reset Page — Shadcn UI Redesign
 * Preserves: searchable dropdown, Enter-key progression, countdown redirect, notification refresh
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { vmAPI, passwordAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { useNotificationContext } from '../context/NotificationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import { cn } from '@/lib/utils';
import {
  KeyRound, Server, ArrowLeft, CheckCircle2, Shield,
  ChevronDown, X, Search, Loader2,
} from 'lucide-react';

const VMPasswordReset = () => {
  const [searchParams] = useSearchParams();
  const preselectedVmId = searchParams.get('vm');
  const { refresh: refreshNotifications } = useNotificationContext();
  const navigate = useNavigate();

  const [vms, setVms] = useState([]);
  const [selectedVm, setSelectedVm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  const [vmSearch, setVmSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const oldPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const submitBtnRef = useRef(null);

  const [formData, setFormData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const fetchVMs = async () => {
      try {
        const response = await vmAPI.getMyVMs();
        const availableVms = (response.vms || []).filter(vm => vm.can_reset_password);
        setVms(availableVms);
        if (preselectedVmId) {
          const vm = availableVms.find(v => v.id === preselectedVmId);
          if (vm) setSelectedVm(vm);
        }
      } catch (err) {
        const msg = err.response?.data?.detail || 'Failed to load VMs';
        setError(msg);
        showError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchVMs();
  }, [preselectedVmId]);

  useEffect(() => {
    if (!success) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); navigate('/vms'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [success, navigate]);

  const filteredVms = vmSearch.trim()
    ? vms.filter(v => v.name.toLowerCase().includes(vmSearch.toLowerCase()) || v.ip_address.toLowerCase().includes(vmSearch.toLowerCase()))
    : vms;

  const handleVmSelect = useCallback((vm) => {
    setSelectedVm(vm);
    setVmSearch('');
    setDropdownOpen(false);
    setError('');
    setValidationErrors({});
    setTimeout(() => oldPasswordRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDropdownKeyDown = (e) => {
    if (!dropdownOpen) { if (e.key === 'ArrowDown' || e.key === 'Enter') { setDropdownOpen(true); setHighlightedIndex(0); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, filteredVms.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filteredVms[highlightedIndex]) handleVmSelect(filteredVms[highlightedIndex]); }
    else if (e.key === 'Escape') { setDropdownOpen(false); }
  };

  const handleFieldKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') { e.preventDefault(); nextRef?.current ? nextRef.current.focus() : submitBtnRef.current?.click(); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) setValidationErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.oldPassword) errors.oldPassword = 'Current password is required';
    if (!formData.newPassword) errors.newPassword = 'New password is required';
    else if (formData.newPassword.length < 8) errors.newPassword = 'At least 8 characters';
    else if (!/[A-Z]/.test(formData.newPassword)) errors.newPassword = 'Must contain uppercase';
    else if (!/[a-z]/.test(formData.newPassword)) errors.newPassword = 'Must contain lowercase';
    else if (!/[0-9]/.test(formData.newPassword)) errors.newPassword = 'Must contain a number';
    else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.newPassword)) errors.newPassword = 'Must contain special char';
    if (formData.oldPassword === formData.newPassword) errors.newPassword = 'Must differ from current';
    if (formData.newPassword !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedVm) { setError('Please select a VM'); showError('Please select a VM'); return; }
    if (!validateForm()) { showError('Please fix the form errors'); return; }
    setSubmitting(true);
    try {
      await passwordAPI.resetPassword(selectedVm.id, formData.oldPassword, formData.newPassword, formData.confirmPassword);
      showSuccess(`Password changed successfully for "${selectedVm.local_username}" on "${selectedVm.name}"!`);
      refreshNotifications();
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to reset password';
      setError(msg);
      showError(msg);
      refreshNotifications();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAnother = () => {
    setSuccess(false);
    setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setSelectedVm(null);
    setError('');
    setValidationErrors({});
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Password Reset Successful!</h2>
            <p className="text-sm text-muted-foreground mb-1">Password changed on:</p>
            <p className="font-medium text-foreground mb-0.5">{selectedVm?.name}</p>
            <p className="text-xs text-muted-foreground mb-5">Username: {selectedVm?.local_username}</p>
            <div className="mb-5">
              <p className="text-xs text-muted-foreground mb-2">
                Redirecting in <span className="font-semibold text-primary">{countdown}s</span>
              </p>
              <Progress value={(countdown / 5) * 100} className="h-1" />
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => navigate('/vms')}>
                <ArrowLeft className="h-4 w-4" /> Go Now
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleResetAnother}>
                Reset Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (vms.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="text-center py-16">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No VMs Available</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">No VMs with password reset permission. Contact your administrator.</p>
            <Link to="/dashboard"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link to="/vms" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My VMs
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reset VM Password</h1>
        <p className="text-sm text-muted-foreground mt-1">Change your password on a Windows VM</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && <Alert variant="error" className="mb-4" onClose={() => setError('')}>{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* VM Selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Select VM <span className="text-destructive">*</span>
              </label>
              <div ref={dropdownRef} className="space-y-1">
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(o => !o); setTimeout(() => searchInputRef.current?.focus(), 30); }}
                  onKeyDown={handleDropdownKeyDown}
                  className="w-full flex items-center justify-between px-3 py-2 border border-input rounded-md bg-transparent text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {selectedVm ? (
                    <span className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-foreground">{selectedVm.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({selectedVm.ip_address})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">— Select a VM —</span>
                  )}
                  <div className="flex items-center gap-1">
                    {selectedVm && (
                      <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); setSelectedVm(null); setVmSearch(''); }} className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
                  </div>
                </button>

                {dropdownOpen && (
                  <div className="w-full bg-popover border border-border rounded-lg shadow-md overflow-hidden z-50">
                    <div className="p-2.5 border-b border-border bg-muted/50">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input ref={searchInputRef} type="text" value={vmSearch}
                          onChange={e => { setVmSearch(e.target.value); setHighlightedIndex(0); }}
                          onKeyDown={handleDropdownKeyDown}
                          placeholder="Search by name or IP..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 ml-0.5">
                        {filteredVms.length} of {vms.length} VM{vms.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ul className="max-h-56 overflow-y-auto custom-scrollbar">
                      {filteredVms.length > 0 ? filteredVms.map((vm, idx) => (
                        <li key={vm.id} onMouseEnter={() => setHighlightedIndex(idx)} onClick={() => handleVmSelect(vm)}
                          className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm",
                            highlightedIndex === idx ? "bg-accent" : "hover:bg-muted/50"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-md shrink-0", highlightedIndex === idx ? "bg-primary/10" : "bg-muted")}>
                            <Server className={cn("h-3.5 w-3.5", highlightedIndex === idx ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("truncate font-medium", highlightedIndex === idx ? "text-accent-foreground" : "text-foreground")}>{vm.name}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{vm.ip_address}</p>
                          </div>
                        </li>
                      )) : <li className="px-4 py-6 text-sm text-center text-muted-foreground">No VMs match your search</li>}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Selected VM Info */}
            {selectedVm && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-3 mb-2.5">
                  <Server className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{selectedVm.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedVm.ip_address}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Your username: </span>
                  <span className="font-medium text-foreground">{selectedVm.local_username}</span>
                </div>
              </div>
            )}

            {/* Password Fields */}
            {selectedVm && (
              <>
                <Input label="Current Password" type="password" name="oldPassword" value={formData.oldPassword}
                  onChange={handleChange} onKeyDown={(e) => handleFieldKeyDown(e, newPasswordRef)}
                  placeholder="Enter current VM password" error={validationErrors.oldPassword}
                  ref={oldPasswordRef} required
                />

                <Input label="New Password" type="password" name="newPassword" value={formData.newPassword}
                  onChange={handleChange} onKeyDown={(e) => handleFieldKeyDown(e, confirmPasswordRef)}
                  placeholder="Enter new password" error={validationErrors.newPassword}
                  ref={newPasswordRef} required
                />
                <PasswordStrengthMeter password={formData.newPassword} />

                <Input label="Confirm New Password" type="password" name="confirmPassword" value={formData.confirmPassword}
                  onChange={handleChange} onKeyDown={(e) => handleFieldKeyDown(e, null)}
                  placeholder="Re-enter new password" error={validationErrors.confirmPassword}
                  ref={confirmPasswordRef} required
                />

                <Button ref={submitBtnRef} type="submit" className="w-full" loading={submitting} disabled={!selectedVm}>
                  <KeyRound className="h-4 w-4" /> Reset Password
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VMPasswordReset;