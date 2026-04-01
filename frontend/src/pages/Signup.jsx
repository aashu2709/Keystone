/**
 * Signup Page with reCAPTCHA v2
 * Fixed: Username field first, preserve original case
 * Note: reCAPTCHA disabled - not compatible with private IP
 */

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Alert, Card, PasswordStrengthMeter } from '../components/ui';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, UserPlus } from 'lucide-react';

// const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY_V2;

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [captchaData, setCaptchaData] = useState({ token: '', answer: '' });
  const captchaRef = useRef(null);
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };



  const validateForm = () => {
    const errors = {};

    // Username validation
    if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9._]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, dots, and underscores';
    }

    // Full name validation
    if (formData.full_name.length < 2) {
      errors.full_name = 'Name must be at least 2 characters';
    }

    // Email validation
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) {
      errors.password = 'Password must contain at least one special character';
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    if (!captchaData.token || !captchaData.answer) {
      setError('Please complete the Math CAPTCHA verification');
      return;
    }

    setLoading(true);

    try {
      await signup({
        username: formData.username,  // Sent as-is (preserves case)
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
      }, captchaData.token, captchaData.answer);

      navigate('/login?registered=true');
    } catch (err) {
      setError(err.message || 'Signup failed');
      if (captchaRef.current) captchaRef.current.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <Shield className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Password Portal</h1>
          <p className="text-primary-100 mt-1">Create your account</p>
        </div>

        <Card className="shadow-xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign up for an account
          </h2>

          {error && (
            <Alert variant="error" className="mb-4" onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Username (First) */}
            <Input
              label="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="User123"
              error={validationErrors.username}
              helperText="Letters, numbers, dots, and underscores only (case preserved)"
              required
              autoFocus
            />

            {/* 2. Full Name */}
            <Input
              label="Full Name"
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="John Doe"
              error={validationErrors.full_name}
              required
            />

            {/* 3. Email */}
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="john@example.com"
              error={validationErrors.email}
              required
            />

            {/* 4. Password */}
            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              error={validationErrors.password}
              required
            />
            {/* Live Password Strength Meter */}
            <PasswordStrengthMeter password={formData.password} />

            {/* 5. Confirm Password */}
            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              error={validationErrors.confirmPassword}
              required
            />

            <MathCaptcha 
              ref={captchaRef} 
              onChange={setCaptchaData} 
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!captchaData.answer}
            >
              <UserPlus size={18} />
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Signup;