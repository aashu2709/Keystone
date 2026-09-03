import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { captchaAPI } from '../services/api';
import { cn } from '@/lib/utils';

/**
 * MathCaptcha Component
 * Renders an SVG math problem and collects the user's answer.
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
      <div className="flex items-center gap-2 p-3 text-destructive bg-destructive/10 rounded-md text-sm border border-destructive/20">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>{error}</span>
        <button type="button" onClick={fetchCaptcha} className="ml-auto underline font-medium hover:no-underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none text-foreground">
        Security Verification <span className="text-destructive">*</span>
      </label>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 h-10 w-36 bg-muted border border-border rounded-md overflow-hidden flex items-center justify-center">
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
             captchaData && <img src={captchaData.image_data} alt="Math CAPTCHA" className="h-full w-full object-cover select-none" draggable="false" />
          )}
        </div>
        
        <button
          type="button"
          onClick={fetchCaptcha}
          disabled={loading}
          className="p-2 text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="Refresh CAPTCHA"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>

        <div className="flex-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="= ?"
            value={answer}
            onChange={handleChange}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-center shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Solve the math problem above to continue.</p>
    </div>
  );
});

MathCaptcha.displayName = 'MathCaptcha';

export default MathCaptcha;
