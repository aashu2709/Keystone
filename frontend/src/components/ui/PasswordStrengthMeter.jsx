import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/Progress';
import { Check, X, Minus } from 'lucide-react';

const PasswordStrengthMeter = ({ password = '' }) => {
  const analysis = useMemo(() => {
    const checks = [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
      { label: 'Contains a number', met: /[0-9]/.test(password) },
      { label: 'Contains special character', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
    ];

    const score = checks.filter((c) => c.met).length;

    let strength = 'none';
    let color = 'bg-muted';
    let label = '';

    if (password.length === 0) {
      strength = 'none';
      label = '';
    } else if (score <= 1) {
      strength = 'weak';
      color = 'bg-red-500';
      label = 'Weak';
    } else if (score <= 2) {
      strength = 'fair';
      color = 'bg-orange-500';
      label = 'Fair';
    } else if (score <= 3) {
      strength = 'good';
      color = 'bg-amber-500';
      label = 'Good';
    } else if (score <= 4) {
      strength = 'strong';
      color = 'bg-emerald-500';
      label = 'Strong';
    } else {
      strength = 'excellent';
      color = 'bg-emerald-600';
      label = 'Excellent';
    }

    return { checks, score, strength, color, label, percentage: (score / checks.length) * 100 };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-muted-foreground">Password Strength</span>
          <span className={cn(
            "text-xs font-semibold",
            analysis.strength === 'weak' && "text-red-600",
            analysis.strength === 'fair' && "text-orange-600",
            analysis.strength === 'good' && "text-amber-600",
            analysis.strength === 'strong' && "text-emerald-600",
            analysis.strength === 'excellent' && "text-emerald-700",
          )}>
            {analysis.label}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500 ease-out", analysis.color)}
            style={{ width: `${analysis.percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-1 gap-1">
        {analysis.checks.map((check, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {check.met ? (
              <Check className="h-3 w-3 text-emerald-600 shrink-0" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className={cn(
              check.met ? "text-foreground" : "text-muted-foreground"
            )}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
