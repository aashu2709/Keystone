
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ShieldAlert, Loader2, Lock, X, Server, Eye, EyeOff } from 'lucide-react';
import { authAPI, getErrorMessage } from '../services/api';

const ConfirmActionDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  actionLabel = "Confirm",
  variant = "destructive",
  isLoading = false
}) => {
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // Verify password with backend
      await authAPI.verifyPassword(password);
      
      // If successful, proceed with the action
      await onConfirm(password);
      setPassword('');
      onClose();
    } catch (err) {
      setError(getErrorMessage(err) || 'Incorrect password');
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    if (verifying || isLoading) return;
    setPassword('');
    setError('');
    onClose();
  };

  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] bg-white border-none shadow-2xl rounded-2xl p-6 overflow-hidden">
        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <Server className="h-7 w-7 text-red-700" />
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-[14px] text-gray-600 leading-relaxed pr-2">
              {description}
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-3">
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={verifying || isLoading}
                className="h-11 pl-10 pr-10 bg-gray-50/50 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {error && (
              <p className="text-[12px] font-medium text-red-600 animate-in fade-in slide-in-from-top-1 duration-200 ml-1">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-row gap-3 sm:gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={verifying || isLoading}
              className="flex-1 h-11 text-sm font-semibold border-gray-200 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={verifying || isLoading || !password}
              className={`flex-1 h-11 text-sm font-bold text-white rounded-lg transition-all active:scale-[0.98] ${
                variant === 'destructive' 
                  ? 'bg-red-600 hover:bg-red-700 shadow-sm' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
              }`}
            >
              {(verifying || isLoading) ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying</span>
                </div>
              ) : (
                actionLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmActionDialog;
