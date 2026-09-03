/**
 * Login Page — Shadcn UI Redesign
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, LogIn, Clock } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaData, setCaptchaData] = useState({ token: '', answer: '' });
  const captchaRef = useRef(null);

  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const countdownRef = useRef(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const fromSignup = searchParams.get('registered');
  const fromReset = searchParams.get('reset');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (rateLimitSeconds > 0) {
      countdownRef.current = setInterval(() => {
        setRateLimitSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            setIsRateLimited(false);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [rateLimitSeconds > 0]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRateLimited) return;

    setError('');
    setLoading(true);

    try {
      await login(username, password, captchaData.token, captchaData.answer);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      if (captchaRef.current) captchaRef.current.refresh();
      const errorMessage = err.message || 'Login failed';

      if (errorMessage.toLowerCase().includes('too many') ||
        errorMessage.toLowerCase().includes('try again in')) {
        setIsRateLimited(true);
        setRateLimitSeconds(60);
        setError('rate_limited');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getDisplayError = () => {
    if (isRateLimited && rateLimitSeconds > 0) {
      return `Too many login attempts. Please try again in ${rateLimitSeconds} seconds.`;
    }
    if (error === 'rate_limited') {
      return 'Too many login attempts. Please try again later.';
    }
    return error;
  };

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">PassPortal</h1>
          <p className="text-sm text-blue-200/70 mt-1">Secure Password Management</p>
        </div>

        <Card className="shadow-2xl border-border/50 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Sign in to your account</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>

          <CardContent>
            {fromSignup && (
              <Alert variant="success" className="mb-4">
                Account created successfully! Please sign in.
              </Alert>
            )}

            {fromReset && (
              <Alert variant="success" className="mb-4">
                Password reset successfully! Please sign in with your new password.
              </Alert>
            )}

            {error && (
              <Alert
                variant={isRateLimited ? "warning" : "error"}
                className="mb-4"
                onClose={isRateLimited ? undefined : () => setError('')}
              >
                <div>
                  <span>{getDisplayError()}</span>
                </div>
                {isRateLimited && rateLimitSeconds > 0 && (
                  <div className="mt-2">
                    <Progress
                      value={(rateLimitSeconds / 60) * 100}
                      className="h-1.5"
                      indicatorClassName="bg-amber-500"
                    />
                  </div>
                )}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                disabled={isRateLimited}
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isRateLimited}
              />

              <MathCaptcha
                ref={captchaRef}
                onChange={setCaptchaData}
              />

              <Button
                type="submit"
                className="w-full"
                loading={loading}
                disabled={!username || !password || !captchaData.answer || isRateLimited}
              >
                {isRateLimited ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Wait {rateLimitSeconds}s
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot your password?
              </Link>
            </div>

            <p className="mt-3 text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;