/**
 * Forgot Password Page
 * Fixed: Clean state management to prevent white screen
 * Updated: Removed reCAPTCHA - not compatible with private IP
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button, Input, Alert, Card } from '../components/ui';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [captchaData, setCaptchaData] = useState({ token: '', answer: '' });
  const captchaRef = useRef(null);

  // Set ready state after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => {
      clearTimeout(timer);
    };
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

  // Show loading until ready
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Mail className="text-green-600" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Check your email
            </h2>
            <p className="text-gray-600 mb-6">
              If an account with that email exists, we've sent a password reset link.
              Please check your inbox (and spam folder).
            </p>
            <Link to="/login">
              <Button variant="secondary" className="w-full">
                <ArrowLeft size={18} />
                Back to Login
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <Shield className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Password Portal</h1>
          <p className="text-primary-100 mt-1">Reset your account password</p>
        </div>

        <Card className="shadow-xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
            Forgot your password?
          </h2>
          <p className="text-gray-600 text-sm text-center mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

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

            <MathCaptcha 
              ref={captchaRef} 
              onChange={setCaptchaData} 
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!email.trim() || !captchaData.answer}
            >
              <Mail size={18} />
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 hover:underline"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;