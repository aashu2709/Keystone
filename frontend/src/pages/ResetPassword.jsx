/**
 * Reset Password Page — Shadcn UI Redesign
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import { Shield, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) { setError('No reset token provided'); setVerifying(false); return; }
      try {
        await authAPI.verifyResetToken(token);
        setTokenValid(true);
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid or expired reset link');
      } finally {
        setVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) setValidationErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (formData.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(formData.newPassword)) errors.newPassword = 'Must contain an uppercase letter';
    else if (!/[a-z]/.test(formData.newPassword)) errors.newPassword = 'Must contain a lowercase letter';
    else if (!/[0-9]/.test(formData.newPassword)) errors.newPassword = 'Must contain a number';
    else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.newPassword)) errors.newPassword = 'Must contain a special character';
    if (formData.newPassword !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    setLoading(true);
    try {
      await authAPI.resetPassword(token, formData.newPassword, formData.confirmPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const bgClass = "min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4";

  if (verifying) {
    return (
      <div className={bgClass}>
        <Card className="shadow-2xl border-border/50 w-full max-w-[420px]">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Verifying reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className={bgClass}>
        <div className="w-full max-w-[420px]">
          <Card className="shadow-2xl border-border/50">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Invalid Reset Link</h2>
              <p className="text-sm text-muted-foreground mb-6">{error}</p>
              <Link to="/forgot-password">
                <Button className="w-full">Request New Reset Link</Button>
              </Link>
              <div className="mt-4">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={bgClass}>
        <div className="w-full max-w-[420px]">
          <Card className="shadow-2xl border-border/50">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Password Reset Successful!</h2>
              <p className="text-sm text-muted-foreground mb-6">You can now login with your new password.</p>
              <Link to="/login?reset=true">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={bgClass}>
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">PassPortal</h1>
          <p className="text-sm text-blue-200/70 mt-1">Create new password</p>
        </div>

        <Card className="shadow-2xl border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Reset your password</CardTitle>
            <CardDescription>Choose a strong, unique password.</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="error" className="mb-4" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="Enter new password"
                error={validationErrors.newPassword}
                required
                autoFocus
              />
              <PasswordStrengthMeter password={formData.newPassword} />

              <Input
                label="Confirm New Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm new password"
                error={validationErrors.confirmPassword}
                required
              />

              <Button type="submit" className="w-full" loading={loading}>
                <KeyRound className="h-4 w-4" />
                Reset Password
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;