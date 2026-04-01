/**
 * Toast Utility
 * =============
 * Wrapper around react-hot-toast for consistent notifications
 */

import toast from 'react-hot-toast';

// ===========================================
// BASIC TOASTS
// ===========================================

export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: 5000,
    ...options,
  });
};

export const showError = (message, options = {}) => {
  return toast.error(message, {
    duration: 6000,
    ...options,
  });
};

export const showInfo = (message, options = {}) => {
  return toast(message, {
    duration: 4000,
    icon: 'ℹ️',
    ...options,
  });
};

export const showWarning = (message, options = {}) => {
  return toast(message, {
    duration: 5000,
    icon: '⚠️',
    style: {
      background: '#FEF3C7',
      color: '#92400E',
    },
    ...options,
  });
};

// ===========================================
// PROMISE TOASTS (for async operations)
// ===========================================

export const showPromise = (promise, messages) => {
  return toast.promise(promise, {
    loading: messages.loading || 'Loading...',
    success: messages.success || 'Success!',
    error: messages.error || 'Something went wrong',
  });
};

// ===========================================
// DISMISS TOASTS
// ===========================================

export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

export const dismissAllToasts = () => {
  toast.dismiss();
};

// Export the original toast for advanced usage
export { toast };