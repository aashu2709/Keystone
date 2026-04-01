/**
 * VM Password Reset Page
 * ======================
 * Form to reset password on a VM
 * 
 * Features:
 *   - Uses passwordAPI for VM password operations
 *   - Shows toast notifications on success/error
 *   - Immediately refreshes notification icon after success
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { vmAPI, passwordAPI } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { useNotificationContext } from '../context/NotificationContext'; // ← ADD
import { Card, Button, Input, Alert } from '../components/ui';
import PasswordStrengthMeter from '../components/ui/PasswordStrengthMeter';
import {
  KeyRound,
  Server,
  ArrowLeft,
  CheckCircle,
  Shield,
  ChevronDown,
  X,
  Search,
} from 'lucide-react';

const VMPasswordReset = () => {
  const [searchParams] = useSearchParams();
  const preselectedVmId = searchParams.get('vm');

  // Get notification refresh function
  const { refresh: refreshNotifications } = useNotificationContext();
  const navigate = useNavigate();

  const [vms, setVms] = useState([]);
  const [selectedVm, setSelectedVm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  // Searchable dropdown state
  const [vmSearch, setVmSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Password field refs for Enter-key navigation
  const oldPasswordRef = useRef(null);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const submitBtnRef = useRef(null);

  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch user's VMs
  useEffect(() => {
    const fetchVMs = async () => {
      try {
        const response = await vmAPI.getMyVMs();
        const availableVms = (response.vms || []).filter(vm => vm.can_reset_password);
        setVms(availableVms);

        if (preselectedVmId) {
          const vm = availableVms.find(v => v.id === preselectedVmId);
          if (vm) {
            setSelectedVm(vm);
          }
        }
      } catch (err) {
        const errorMessage = err.response?.data?.detail || 'Failed to load VMs';
        setError(errorMessage);
        showError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchVMs();
  }, [preselectedVmId]);

  // Countdown redirect after success
  useEffect(() => {
    if (!success) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/vms');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [success, navigate]);

  // Filtered VM list for dropdown
  const filteredVms = vmSearch.trim()
    ? vms.filter(
      v =>
        v.name.toLowerCase().includes(vmSearch.toLowerCase()) ||
        v.ip_address.toLowerCase().includes(vmSearch.toLowerCase())
    )
    : vms;

  const handleVmSelect = useCallback((vm) => {
    setSelectedVm(vm);
    setVmSearch('');
    setDropdownOpen(false);
    setError('');
    setValidationErrors({});
    // Focus first password field after selection
    setTimeout(() => oldPasswordRef.current?.focus(), 50);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard navigation inside the dropdown list
  const handleDropdownKeyDown = (e) => {
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setDropdownOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredVms.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredVms[highlightedIndex]) handleVmSelect(filteredVms[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  // Enter-key progression between password fields
  const handleFieldKeyDown = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      } else {
        // Last field — submit
        submitBtnRef.current?.click();
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.oldPassword) {
      errors.oldPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(formData.newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.newPassword)) {
      errors.newPassword = 'Password must contain at least one special character';
    }

    if (formData.oldPassword === formData.newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedVm) {
      setError('Please select a VM');
      showError('Please select a VM');
      return;
    }

    if (!validateForm()) {
      showError('Please fix the form errors');
      return;
    }

    setSubmitting(true);

    try {
      await passwordAPI.resetPassword(
        selectedVm.id,
        formData.oldPassword,
        formData.newPassword,
        formData.confirmPassword
      );

      // Show success toast
      showSuccess(
        `Password changed successfully for "${selectedVm.local_username}" on "${selectedVm.name}"!`
      );

      // ========================================
      // IMMEDIATELY REFRESH NOTIFICATIONS
      // ========================================
      refreshNotifications();

      setSuccess(true);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Failed to reset password';
      setError(errorMessage);
      showError(errorMessage);

      // Also refresh notifications for failure notification
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="text-center">
          {/* Success icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>

          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Password Reset Successful!
          </h2>
          <p className="text-gray-600 mb-1">Your password has been changed on:</p>
          <p className="font-medium text-gray-800 mb-1">{selectedVm?.name}</p>
          <p className="text-sm text-gray-500 mb-6">Username: {selectedVm?.local_username}</p>

          {/* Countdown bar */}
          <div className="mb-5">
            <p className="text-sm text-gray-500 mb-2">
              Redirecting to My VMs in{' '}
              <span className="font-semibold text-primary-600">{countdown}s</span>…
            </p>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            {/* Go now */}
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => navigate('/vms')}
            >
              <ArrowLeft size={16} />
              Go Now
            </Button>

            {/* Cancel redirect and reset another */}
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleResetAnother}
            >
              Reset Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // No VMs available
  if (vms.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="text-center">
          <Server className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No VMs Available</h3>
          <p className="mt-2 text-gray-500 mb-6">
            You don't have any VMs with password reset permission.
            <br />
            Please contact your administrator.
          </p>
          <Link to="/dashboard">
            <Button variant="secondary">
              <ArrowLeft size={18} />
              Back to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link to="/vms" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-4" >
          <ArrowLeft size={16} />
          Back to My VMs
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Reset VM Password</h1>
        <p className="text-gray-500 mt-1">
          Change your password on a Windows VM
        </p>
      </div>

      <Card>
        {error && (
          <Alert variant="error" className="mb-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* VM Selection — Searchable Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select VM <span className="text-red-500">*</span>
            </label>

            <div ref={dropdownRef} className="space-y-1">
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => { setDropdownOpen(o => !o); setTimeout(() => searchInputRef.current?.focus(), 30); }}
                onKeyDown={handleDropdownKeyDown}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              >
                {selectedVm ? (
                  <span className="flex items-center gap-2">
                    <Server size={15} className="text-primary-600 flex-shrink-0" />
                    <span className="font-medium text-gray-800">{selectedVm.name}</span>
                    <span className="text-gray-400 text-sm">({selectedVm.ip_address})</span>
                  </span>
                ) : (
                  <span className="text-gray-400">-- Select a VM --</span>
                )}
                <div className="flex items-center gap-1">
                  {selectedVm && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); setSelectedVm(null); setVmSearch(''); }}
                      className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </span>
                  )}
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown panel */}
              {dropdownOpen && (
                <div className="w-full bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                  {/* Search input inside dropdown */}
                  <div className="p-3 border-b border-gray-100 bg-gray-50">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={vmSearch}
                        onChange={e => { setVmSearch(e.target.value); setHighlightedIndex(0); }}
                        onKeyDown={handleDropdownKeyDown}
                        placeholder="Search by name or IP address…"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5 ml-0.5">
                      {filteredVms.length} of {vms.length} VM{vms.length !== 1 ? 's' : ''} shown
                    </p>
                  </div>

                  {/* VM list — all shown by default, filtered as you type */}
                  <ul className="max-h-64 overflow-y-auto">
                    {filteredVms.length > 0 ? (
                      filteredVms.map((vm, idx) => (
                        <li
                          key={vm.id}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleVmSelect(vm)}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${highlightedIndex === idx ? 'bg-primary-50' : 'hover:bg-gray-50'
                            }`}
                        >
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${highlightedIndex === idx ? 'bg-primary-100' : 'bg-gray-100'}`}>
                            <Server size={16} className={highlightedIndex === idx ? 'text-primary-600' : 'text-gray-500'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm truncate ${highlightedIndex === idx ? 'text-primary-700' : 'text-gray-800'}`}>
                              {vm.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{vm.ip_address}</p>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-6 text-sm text-center text-gray-400">No VMs match your search</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Selected VM Info */}
          {selectedVm && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Server className="text-primary-600" size={24} />
                <div>
                  <p className="font-medium text-gray-800">{selectedVm.name}</p>
                  <p className="text-sm text-gray-500">{selectedVm.ip_address}</p>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Your username on this VM: </span>
                <span className="font-medium text-gray-800">{selectedVm.local_username}</span>
              </div>
            </div>
          )}

          {/* Password Fields */}
          {selectedVm && (
            <>
              <Input
                label="Current Password"
                type="password"
                name="oldPassword"
                value={formData.oldPassword}
                onChange={handleChange}
                onKeyDown={(e) => handleFieldKeyDown(e, newPasswordRef)}
                placeholder="Enter your current VM password"
                error={validationErrors.oldPassword}
                ref={oldPasswordRef}
                required
              />

              <Input
                label="New Password"
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                onKeyDown={(e) => handleFieldKeyDown(e, confirmPasswordRef)}
                placeholder="Enter new password"
                error={validationErrors.newPassword}
                ref={newPasswordRef}
                required
              />
              {/* Live Password Strength Meter */}
              <PasswordStrengthMeter password={formData.newPassword} />

              <Input
                label="Confirm New Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onKeyDown={(e) => handleFieldKeyDown(e, null)}
                placeholder="Re-enter your new password"
                error={validationErrors.confirmPassword}
                ref={confirmPasswordRef}
                required
              />

              <Button
                ref={submitBtnRef}
                type="submit"
                className="w-full"
                loading={submitting}
                disabled={!selectedVm}
              >
                <KeyRound size={18} />
                Reset Password
              </Button>
            </>
          )}
        </form>
      </Card>
    </div>
  );
};

export default VMPasswordReset;