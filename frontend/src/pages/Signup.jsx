/**
 * Signup Page — Shadcn UI Redesign
 */

import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';
import MathCaptcha from '../components/MathCaptcha';
import { Shield, UserPlus } from 'lucide-react';

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

    if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9._]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, dots, and underscores';
    }

    if (formData.full_name.length < 2) {
      errors.full_name = 'Name must be at least 2 characters';
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

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

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    if (!captchaData.token || !captchaData.answer) {
      setError('Please complete the Math CAPTCHA verification');
      return;
    }

    setLoading(true);

    try {
      await signup({
        username: formData.username,
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-white">PassPortal</h1>
          <p className="text-sm text-blue-200/70 mt-1">Create your account</p>
        </div>

        <Card className="shadow-2xl border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Sign up for an account</CardTitle>
            <CardDescription>Fill in the details below to get started</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="error" className="mb-4" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="User123"
                error={validationErrors.username}
                required
                autoFocus
              />

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
              <PasswordStrengthMeter password={formData.password} />

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
                <UserPlus className="h-4 w-4" />
                Create Account
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;