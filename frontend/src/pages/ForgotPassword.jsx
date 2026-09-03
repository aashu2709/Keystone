/**
 * Forgot Password Page — Shadcn UI Redesign
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [captchaData, setCaptchaData] = useState({ token: '', answer: '' });
  const captchaRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!captchaData.token || !captchaData.answer) {
      setError('Please complete the Math CAPTCHA verification');
      return;
    }

    setLoading(true);

    try {
      await authAPI.forgotPassword(email.trim(), captchaData.token, captchaData.answer);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to send reset email');
      if (captchaRef.current) captchaRef.current.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          <p className="mt-4 text-sm text-blue-200/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
        <div className="w-full max-w-[420px]">
          <Card className="shadow-2xl border-border/50">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 mb-4">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground mb-6">
                If an account with that email exists, we've sent a password reset link. Please check your inbox and spam folder.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">PassPortal</h1>
          <p className="text-sm text-blue-200/70 mt-1">Reset your account password</p>
        </div>

        <Card className="shadow-2xl border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Forgot your password?</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="error" className="mb-4" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoFocus
              />

              <MathCaptcha ref={captchaRef} onChange={setCaptchaData} />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={!email.trim() || !captchaData.answer}
              >
                <Mail className="h-4 w-4" />
                Send Reset Link
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;