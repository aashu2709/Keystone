/**
 * API Service
 * ===========
 * Centralized API calls with authentication handling.
 * This file matches EXACTLY with backend endpoints.
 * 
 * Backend Routers:
 *   /api/auth/*          → authAPI
 *   /api/vms/*           → vmAPI (user's assigned VMs only)
 *   /api/password/*      → passwordAPI (VM password operations)
 *   /api/notifications/* → notificationAPI
 *   /api/admin/*         → adminAPI (admin only)
 *
 */

import axios from 'axios';

// ===========================================
// AXIOS INSTANCE SETUP
// ===========================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Add auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ===========================================
// RESPONSE INTERCEPTOR - Handle errors globally
// ===========================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    // Handle 401 Unauthorized (token expired/invalid)
    if (status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // Handle 429 Rate Limit Exceeded
    if (status === 429) {
      // Extract the rate limit message from response
      let rateLimitMessage = 'Too many requests. Please try again later.';
      let retryAfter = 60;

      if (data?.detail) {
        if (typeof data.detail === 'object') {
          rateLimitMessage = data.detail.message || rateLimitMessage;
          retryAfter = data.detail.retry_after_seconds || retryAfter;
        } else if (typeof data.detail === 'string') {
          rateLimitMessage = data.detail;
        }
      }

      // Create a custom error with rate limit info
      const rateLimitError = new Error(rateLimitMessage);
      rateLimitError.isRateLimitError = true;
      rateLimitError.retryAfter = retryAfter;
      rateLimitError.status = 429;
      rateLimitError.originalError = error;

      console.warn(`🚫 Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      
      return Promise.reject(rateLimitError);
    }

    return Promise.reject(error);
  }
);

// ===========================================
// HELPER FUNCTION: Extract error message
// ===========================================
export const getErrorMessage = (error) => {
  // Rate limit error
  if (error.isRateLimitError) {
    return error.message;
  }

  // Axios error with response
  if (error.response?.data) {
    const data = error.response.data;

    // Handle different error formats
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (typeof data.detail === 'object' && data.detail.message) {
      return data.detail.message;
    }
    if (data.message) {
      return data.message;
    }
    if (data.error) {
      return data.error;
    }
  }

  // Network error
  if (error.message === 'Network Error') {
    return 'Unable to connect to server. Please check your connection.';
  }

  // Timeout error
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  // Default message
  return error.message || 'An unexpected error occurred.';
};

// ===========================================
// AUTH API (/api/auth)
// ===========================================
export const authAPI = {
  /**
   * Register a new user
   * POST /auth/signup
   * @param {Object} userData - { username, email, password, full_name }
   * @param {string} captchaToken - Encrypted token from backend
   * @param {string} captchaAnswer - User's math answer
   */
  signup: async (userData, captchaToken, captchaAnswer) => {
    const response = await api.post('/auth/signup', {
      ...userData,
      captcha_token: captchaToken,
      captcha_answer: captchaAnswer,
    });
    return response.data;
  },

  /**
   * Login and get JWT token
   * POST /auth/login
   * @param {string} username
   * @param {string} password
   * @param {string} captchaToken - Encrypted token from backend
   * @param {string} captchaAnswer - User's math answer
   */
  login: async (username, password, captchaToken, captchaAnswer) => {
    const response = await api.post('/auth/login', {
      username,
      password,
      captcha_token: captchaToken,
      captcha_answer: captchaAnswer,
    });
    // Store token and user in localStorage
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  /**
   * Logout user
   * POST /auth/logout
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors - we'll clear local storage anyway
      console.log('Logout API error (ignored):', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  },

  /**
   * Get current user profile
   * GET /auth/me
   */
  getProfile: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Request password reset email (for portal password, not VM)
   * POST /auth/forgot-password
   * @param {string} email
   * @param {string} captchaToken - Encrypted token from backend
   * @param {string} captchaAnswer - User's math answer
   */
  forgotPassword: async (email, captchaToken, captchaAnswer) => {
    const response = await api.post('/auth/forgot-password', {
      email,
      captcha_token: captchaToken,
      captcha_answer: captchaAnswer,
    });
    return response.data;
  },

  /**
   * Verify if reset token is valid
   * GET /auth/verify-reset-token/{token}
   * @param {string} token - Reset token from email
   */
  verifyResetToken: async (token) => {
    const response = await api.get(`/auth/verify-reset-token/${token}`);
    return response.data;
  },

  /**
   * Reset portal password using token from email
   * POST /auth/reset-password
   * Note: This is for PORTAL password, not VM password
   * @param {string} token - Reset token from email
   * @param {string} newPassword
   * @param {string} confirmPassword
   */
  resetPassword: async (token, newPassword, confirmPassword) => {
    const response = await api.post('/auth/reset-password', {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },
};

// ===========================================
// CAPTCHA API (/api/captcha)
// ===========================================
export const captchaAPI = {
  /**
   * Get a new Math CAPTCHA
   * GET /captcha
   * Returns: { image_data, captcha_token, token_expires_in }
   */
  getCaptcha: async () => {
    const response = await api.get('/captcha');
    return response.data;
  },
};

// ===========================================
// USER'S VMs API (/api/vms)
// For viewing assigned VMs only
// ===========================================
export const vmAPI = {
  /**
   * Get all VMs assigned to current user
   * GET /vms
   * Returns list of VMs with:
   *   - VM details (name, IP, description, health status)
   *   - User's local username on each VM
   *   - Permissions (can_reset_password)
   */
  getMyVMs: async () => {
    const response = await api.get('/vms');
    return response.data;
  },

  /**
   * Get specific VM details (only if user has access)
   * GET /vms/{vm_id}
   * @param {string} vmId - VM UUID
   */
  getVM: async (vmId) => {
    const response = await api.get(`/vms/${vmId}`);
    return response.data;
  },
};

// ===========================================
// PASSWORD API (/api/password)
// For VM password operations
// ===========================================
export const passwordAPI = {
  /**
   * Reset password on a VM
   * POST /password/reset
   * 
   * This endpoint:
   *   - Validates user has access to the VM
   *   - Validates password strength
   *   - Checks password history (prevents reuse of last 5)
   *   - Executes PowerShell to change password on VM
   *   - Creates audit log entry
   *   - Sends notification to user
   * 
   * @param {string} vmId - VM UUID
   * @param {string} oldPassword - Current VM password
   * @param {string} newPassword - New VM password
   * @param {string} confirmPassword - Confirm new password
   */
  resetPassword: async (vmId, oldPassword, newPassword, confirmPassword) => {
    const response = await api.post('/password/reset', {
      vm_id: vmId,
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  /**
   * Get password change history for a VM
   * GET /password/history/{vm_id}
   * 
   * Returns:
   *   - When passwords were changed
   *   - Who changed them
   *   - Does NOT return actual passwords (only for security)
   * 
   * @param {string} vmId - VM UUID
   * @param {string|null} localUsername - (Admin only) Specify which user's history
   */
  getHistory: async (vmId, localUsername = null) => {
    const params = {};
    if (localUsername) {
      params.local_username = localUsername;
    }
    const response = await api.get(`/password/history/${vmId}`, { params });
    return response.data;
  },

  /**
   * Get audit logs for current user's password operations
   * GET /password/audit
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Max records (default: 50)
   * @param {number} params.offset - Skip count for pagination (default: 0)
   * @param {string} params.action - Filter by action type (e.g., 'password_reset')
   */
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/password/audit', { params });
    return response.data;
  },

  /**
   * Get all users' audit logs (admin only)
   * GET /password/audit?all=true
   * @param {Object} params - Query parameters (same as getAuditLogs)
   */
  getAllAuditLogs: async (params = {}) => {
    const response = await api.get('/password/audit', {
      params: { ...params, all: true },
    });
    return response.data;
  },
};

// ===========================================
// NOTIFICATIONS API (/api/notifications)
// ===========================================
export const notificationAPI = {
  /**
   * Get all notifications for current user
   * GET /notifications
   * @param {Object} params - Query parameters
   * @param {number} params.limit - Max notifications (default: 20)
   * @param {number} params.offset - Skip count for pagination (default: 0)
   * @param {boolean} params.unread_only - Only return unread (default: false)
   */
  getAll: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  /**
   * Get unread notification count only
   * GET /notifications/count
   * Lightweight endpoint for badge display
   */
  getUnreadCount: async () => {
    const response = await api.get('/notifications/count');
    return response.data;
  },

  /**
   * Mark single notification as read
   * PUT /notifications/{id}/read
   * @param {string} notificationId - Notification UUID
   */
  markAsRead: async (notificationId) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark multiple notifications as read
   * PUT /notifications/read-multiple
   * @param {string[]} notificationIds - Array of notification UUIDs
   */
  markMultipleAsRead: async (notificationIds) => {
    const response = await api.put('/notifications/read-multiple', {
      notification_ids: notificationIds,
    });
    return response.data;
  },

  /**
   * Mark all notifications as read
   * PUT /notifications/read-all
   */
  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  /**
   * Delete single notification
   * DELETE /notifications/{id}
   * @param {string} notificationId - Notification UUID
   */
  delete: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  /**
   * Delete all read notifications
   * DELETE /notifications/clear-read
   */
  clearRead: async () => {
    const response = await api.delete('/notifications/clear-read');
    return response.data;
  },
};

// ===========================================
// ADMIN API (/api/admin)
// All endpoints require admin or superadmin role
// ===========================================
export const adminAPI = {
  // ===== VMs Management =====

  /**
   * Get all VMs (admin only)
   * GET /admin/vms
   * @param {Object} params - Query parameters
   * @param {number} params.skip - Pagination offset (default: 0)
   * @param {number} params.limit - Max records (default: 50)
   * @param {string} params.search - Search by name/IP/description
   */
  getVMs: async (params = {}) => {
    const response = await api.get('/admin/vms', { params });
    return response.data;
  },

  /**
   * Get specific VM (admin only)
   * GET /admin/vms/{vm_id}
   * @param {string} vmId - VM UUID
   */
  getVM: async (vmId) => {
    const response = await api.get(`/admin/vms/${vmId}`);
    return response.data;
  },

  /**
   * Create new VM (admin only)
   * POST /admin/vms
   * @param {Object} vmData - VM data
   * @param {string} vmData.name - VM display name
   * @param {string} vmData.ip_address - VM IP address
   * @param {string} vmData.description - Optional description
   * @param {string} vmData.os_version - OS version (default: "Windows Server 2022")
   * @param {number} vmData.winrm_port - WinRM port (default: 5985)
   * @param {string} vmData.admin_username - VM admin username
   * @param {string} vmData.admin_password - VM admin password (will be encrypted)
   */
  createVM: async (vmData) => {
    const response = await api.post('/admin/vms', vmData);
    return response.data;
  },

  /**
   * Update VM (admin only)
   * PUT /admin/vms/{vm_id}
   * @param {string} vmId - VM UUID
   * @param {Object} vmData - Fields to update (all optional)
   */
  updateVM: async (vmId, vmData) => {
    const response = await api.put(`/admin/vms/${vmId}`, vmData);
    return response.data;
  },

  /**
   * Delete VM (admin only)
   * DELETE /admin/vms/{vm_id}
   * Also deletes all mappings for this VM
   * @param {string} vmId - VM UUID
   */
  deleteVM: async (vmId) => {
    const response = await api.delete(`/admin/vms/${vmId}`);
    return response.data;
  },

  // ===== VM Health Checks =====

  /**
   * Check health of a single VM
   * POST /admin/vms/{vm_id}/health-check
   * @param {string} vmId - VM UUID
   */
  checkVMHealth: async (vmId) => {
    const response = await api.post(`/admin/vms/${vmId}/health-check`);
    return response.data;
  },

  /**
   * Check health of all active VMs
   * POST /admin/vms/health-check-all
   */
  checkAllVMsHealth: async () => {
    const response = await api.post('/admin/vms/health-check-all');
    return response.data;
  },

  // ===== Admin Dashboard Stats =====

  /**
   * Get system-wide statistics for admin dashboard
   * GET /admin/stats
   * Returns:
   *   - User counts (total, active, admins)
   *   - VM counts (total, healthy, unreachable)
   *   - Mapping counts
   *   - Password reset counts (total, today, this week)
   *   - Recent activity (last 10 actions)
   */
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // ===== Users Management =====

  /**
   * Get all users (admin only)
   * GET /admin/users
   * @param {Object} params - Query parameters
   * @param {number} params.skip - Pagination offset
   * @param {number} params.limit - Max records
   * @param {string} params.search - Search by username/email/name
   * @param {string} params.role - Filter by role (user/admin/superadmin)
   */
  getUsers: async (params = {}) => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  /**
   * Update user role (admin only)
   * PUT /admin/users/{user_id}/role?role=admin
   * @param {string} userId - User UUID
   * @param {string} role - New role (user/admin/superadmin)
   */
  updateUserRole: async (userId, role) => {
    const response = await api.put(`/admin/users/${userId}/role`, null, {
      params: { role },
    });
    return response.data;
  },

  /**
   * Activate/deactivate user (admin only)
   * PUT /admin/users/{user_id}/status?is_active=true
   * @param {string} userId - User UUID
   * @param {boolean} isActive - Active status
   */
  updateUserStatus: async (userId, isActive) => {
    const response = await api.put(`/admin/users/${userId}/status`, null, {
      params: { is_active: isActive },
    });
    return response.data;
  },

  // ===== User-VM Mappings =====

  /**
   * Get all user-VM mappings (admin only)
   * GET /admin/mappings
   * @param {Object} params - Query parameters
   * @param {number} params.skip - Pagination offset
   * @param {number} params.limit - Max records
   * @param {string} params.user_id - Filter by user
   * @param {string} params.vm_id - Filter by VM
   */
  getMappings: async (params = {}) => {
    const response = await api.get('/admin/mappings', { params });
    return response.data;
  },

  /**
   * Create user-VM mapping (admin only)
   * POST /admin/mappings
   * @param {Object} mappingData
   * @param {string} mappingData.user_id - User UUID
   * @param {string} mappingData.vm_id - VM UUID
   * @param {string} mappingData.local_username - Username on the VM
   * @param {boolean} mappingData.can_reset_password - Permission to reset password
   * @param {boolean} mappingData.can_view_history - Permission to view password history
   * @param {string} mappingData.notes - Optional notes
   */
  createMapping: async (mappingData) => {
    const response = await api.post('/admin/mappings', mappingData);
    return response.data;
  },

  /**
   * Update mapping (admin only)
   * PUT /admin/mappings/{mapping_id}
   * @param {string} mappingId - Mapping UUID
   * @param {Object} mappingData - Fields to update
   */
  updateMapping: async (mappingId, mappingData) => {
    const response = await api.put(`/admin/mappings/${mappingId}`, mappingData);
    return response.data;
  },

  /**
   * Delete mapping (admin only)
   * DELETE /admin/mappings/{mapping_id}
   * @param {string} mappingId - Mapping UUID
   */
  deleteMapping: async (mappingId) => {
    const response = await api.delete(`/admin/mappings/${mappingId}`);
    return response.data;
  },

  // ===== Audit Logs =====

  /**
   * Get all audit logs (admin only)
   * GET /admin/audit-logs
   * @param {Object} params - Query parameters
   * @param {number} params.skip - Pagination offset
   * @param {number} params.limit - Max records
   * @param {string} params.action - Filter by action type
   * @param {string} params.user_id - Filter by user
   */
  getAuditLogs: async (params = {}) => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
  },
};

// ===========================================
// REMOTE USER MANAGEMENT API (/api/admin/remote-users)
// All endpoints require admin role
// ===========================================
export const remoteUserAPI = {
  /**
   * Create a local user on one or more remote VMs
   * POST /admin/remote-users/create
   * @param {Object} data
   * @param {string} data.username - Local username to create
   * @param {string} data.full_name - Display name
   * @param {string} data.password - Initial password
   * @param {string} data.description - Optional description
   * @param {string} data.user_type - 'standard' or 'administrator'
   * @param {boolean} data.must_change_password - Force change at next logon
   * @param {string[]} data.vm_ids - Array of VM IDs
   */
  createUser: async (data) => {
    const response = await api.post('/admin/remote-users/create', data);
    return response.data;
  },

  /**
   * Disable a user on one or more VMs
   * POST /admin/remote-users/disable
   * @param {Object} data - { username, vm_ids }
   */
  disableUser: async (data) => {
    const response = await api.post('/admin/remote-users/disable', data);
    return response.data;
  },

  /**
   * Enable a user on one or more VMs
   * POST /admin/remote-users/enable
   * @param {Object} data - { username, vm_ids }
   */
  enableUser: async (data) => {
    const response = await api.post('/admin/remote-users/enable', data);
    return response.data;
  },

  /**
   * Unlock a locked-out user on one or more VMs
   * POST /admin/remote-users/unlock
   * @param {Object} data - { username, vm_ids }
   */
  unlockUser: async (data) => {
    const response = await api.post('/admin/remote-users/unlock', data);
    return response.data;
  },

  /**
   * Delete a user from one or more VMs (also removes Keystone mappings)
   * POST /admin/remote-users/delete
   * @param {Object} data - { username, vm_ids }
   */
  deleteUser: async (data) => {
    const response = await api.post('/admin/remote-users/delete', data);
    return response.data;
  },

  /**
   * List all local users on a specific VM
   * GET /admin/remote-users/list/{vmId}
   * @param {string} vmId - VM UUID
   */
  listUsers: async (vmId) => {
    const response = await api.get(`/admin/remote-users/list/${vmId}`);
    return response.data;
  },

  /**
   * Generate a strong random password
   * GET /admin/remote-users/generate-password
   * @param {number} length - Password length (default: 16)
   */
  generatePassword: async (length = 16) => {
    const response = await api.get('/admin/remote-users/generate-password', {
      params: { length },
    });
    return response.data;
  },

  /**
   * Reset a portal user's password on all their mapped remote VMs
   * POST /admin/remote-users/bulk-password-reset
   * @param {Object} data - { user_id, new_password, vm_ids }
   */
  bulkPasswordReset: async (data) => {
    const response = await api.post('/admin/remote-users/bulk-password-reset', data);
    return response.data;
  },
};

// ===========================================
// FIREWALL API (/api/admin/vms/{vm_id}/firewall)
// ===========================================
export const firewallAPI = {
  getRules: async (vmId) => {
    const response = await api.get(`/admin/vms/${vmId}/firewall`);
    return response.data;
  },
  createRule: async (vmId, ruleData) => {
    const response = await api.post(`/admin/vms/${vmId}/firewall`, ruleData);
    return response.data;
  },
  deleteRule: async (vmId, ruleName) => {
    const response = await api.delete(`/admin/vms/${vmId}/firewall/${ruleName}`);
    return response.data;
  },
  toggleRule: async (vmId, ruleName) => {
    const response = await api.put(`/admin/vms/${vmId}/firewall/${ruleName}/toggle`);
    return response.data;
  },
  updateRule: async (vmId, ruleName, ruleData) => {
    const response = await api.put(`/admin/vms/${vmId}/firewall/${ruleName}`, ruleData);
    return response.data;
  },
  createBulkRule: async (data) => {
    const response = await api.post('/admin/firewall/bulk-create', data);
    return response.data;
  }
};

// ===========================================
// CERTIFICATES API (/api/admin/vms/{vm_id}/certificates)
// ===========================================
export const certificateAPI = {
  getCertificates: async (vmId) => {
    const response = await api.get(`/admin/vms/${vmId}/certificates`);
    return response.data;
  }
};

// Export the axios instance for custom requests
export default api;