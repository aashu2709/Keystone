/**
 * Login Page
 * Updated: Countdown starts from 60, single icon
 * Note: reCAPTCHA removed - not compatible with private IP
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Alert, Card } from '../components/ui';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, LogIn, Clock } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaData, setCaptchaData] = useState({ token: '', answer: '' });
  const captchaRef = useRef(null);

  // Rate limit countdown state
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const countdownRef = useRef(null);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check URL params for success messages
  const searchParams = new URLSearchParams(location.search);
  const fromSignup = searchParams.get('registered');
  const fromReset = searchParams.get('reset');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Countdown timer effect
  useEffect(() => {
    if (rateLimitSeconds > 0) {
      countdownRef.current = setInterval(() => {
        setRateLimitSeconds((prev) => {
          if (prev <= 1) {
            // Timer finished
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
  }, [rateLimitSeconds > 0]); // Only re-run when we start a new countdown

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Don't allow submit if rate limited
    if (isRateLimited) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Login with Math CAPTCHA
      await login(username, password, captchaData.token, captchaData.answer);
      
      // Redirect to original destination or dashboard
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      if (captchaRef.current) captchaRef.current.refresh();
      const errorMessage = err.message || 'Login failed';
      
      // Check if this is a rate limit error
      if (errorMessage.toLowerCase().includes('too many') || 
          errorMessage.toLowerCase().includes('try again in')) {
        setIsRateLimited(true);
        
        // Always start from 60 seconds for consistent UX
        setRateLimitSeconds(60);
        
        // Don't set the original error message, we'll generate our own
        setError('rate_limited');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Format the error message with current countdown
  const getDisplayError = () => {
    if (isRateLimited && rateLimitSeconds > 0) {
      return `Too many login attempts. Please try again in ${rateLimitSeconds} seconds.`;
    }
    if (error === 'rate_limited') {
      return 'Too many login attempts. Please try again later.';
    }
    return error;
  };

  // Don't render if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <Shield className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Password Portal</h1>
          <p className="text-primary-100 mt-1">Secure Password Management</p>
        </div>

        <Card className="shadow-xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign in to your account
          </h2>

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
              
              {/* Progress bar for rate limit */}
              {isRateLimited && rateLimitSeconds > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-yellow-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(rateLimitSeconds / 60) * 100}%` }}
                    />
                  </div>
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
                  <Clock size={18} className="animate-spin" />
                  Wait {rateLimitSeconds}s
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-primary-600 hover:text-primary-700 font-medium hover:underline"
            >
              Create one
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Login;