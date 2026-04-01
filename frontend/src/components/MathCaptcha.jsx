import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { captchaAPI } from '../services/api';
import { Input } from './ui';

/**
 * MathCaptcha Component
 * Renders an SVG math problem and collects the user's answer.
 * 
 * Props:
 * - onChange: (data: { token: str, answer: str }) => void
 */
const MathCaptcha = forwardRef(({ onChange }, ref) => {
  const [captchaData, setCaptchaData] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCaptcha = async () => {
    setLoading(true);
    setError('');
    setAnswer('');
    onChange({ token: '', answer: '' });
    
    try {
      const data = await captchaAPI.getCaptcha();
      setCaptchaData(data);
    } catch (err) {
      console.error('Failed to load CAPTCHA:', err);
      setError('Failed to load CAPTCHA test');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose a fetchCaptcha method to parent components (useful after failed login)
  useImperativeHandle(ref, () => ({
    refresh: fetchCaptcha
  }));

  const handleChange = (e) => {
    const val = e.target.value;
    setAnswer(val);
    if (captchaData) {
      onChange({ token: captchaData.captcha_token, answer: val });
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-md text-sm border border-red-200">
        <ShieldAlert size={16} />
        <span>{error}</span>
        <button type="button" onClick={fetchCaptcha} className="ml-auto underline font-medium">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Security Verification <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 h-10 w-36 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center relative shadow-sm">
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
          ) : (
             captchaData && <img src={captchaData.image_data} alt="Math CAPTCHA" className="h-full w-full object-cover select-none" draggable="false" />
          )}
        </div>
        
        <button
          type="button"
          onClick={fetchCaptcha}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
          title="Refresh CAPTCHA"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>

        <div className="flex-1">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="= ?"
            value={answer}
            onChange={handleChange}
            className="w-full text-center"
            required
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">Please solve the math problem to continue.</p>
    </div>
  );
});

MathCaptcha.displayName = 'MathCaptcha';

export default MathCaptcha;
