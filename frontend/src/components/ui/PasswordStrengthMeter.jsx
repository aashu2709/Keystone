/**
 * PasswordStrengthMeter Component
 * =================================
 * Displays a live password strength bar and per-rule checklist.
 * Replaces the static blue requirements info box.
 *
 * Props:
 *   password {string}  - The current password value to evaluate
 *   className {string} - Optional extra class names on the wrapper
 */

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// ─── Rule Definitions ────────────────────────────────────────────────────────

const RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (p) => p.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter (A–Z)',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter (a–z)',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'One number (0–9)',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'One special character (!@#$%…)',
    test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p),
  },
];

// ─── Strength Level Config ────────────────────────────────────────────────────

const LEVELS = [
  { label: 'Too Weak', color: 'bg-red-500', text: 'text-red-600', segments: 1 },
  { label: 'Weak', color: 'bg-orange-400', text: 'text-orange-500', segments: 2 },
  { label: 'Fair', color: 'bg-yellow-400', text: 'text-yellow-600', segments: 3 },
  { label: 'Strong', color: 'bg-emerald-400', text: 'text-emerald-600', segments: 4 },
  { label: 'Very Strong', color: 'bg-green-500', text: 'text-green-600', segments: 5 },
];

// ─── Component ────────────────────────────────────────────────────────────────

const PasswordStrengthMeter = ({ password = '', className = '' }) => {
  const evaluated = useMemo(() => {
    return RULES.map((rule) => ({
      ...rule,
      passed: password.length > 0 ? rule.test(password) : false,
    }));
  }, [password]);

  const passedCount = evaluated.filter((r) => r.passed).length;

  // Determine level: 0 rules = index 0, all 5 = index 4
  const levelIndex = password.length === 0 ? -1 : Math.min(passedCount - 1, 4);
  const level = levelIndex >= 0 ? LEVELS[levelIndex] : null;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* ── Strength Bar ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-500">Password strength</span>
          {level && (
            <span className={`text-xs font-semibold ${level.text} transition-colors duration-300`}>
              {level.label}
            </span>
          )}
        </div>

        {/* 5-segment bar */}
        <div className="flex gap-1">
          {LEVELS.map((lvl, idx) => {
            const filled = idx < (passedCount);
            return (
              <div
                key={idx}
                className={`
                  h-1.5 flex-1 rounded-full transition-all duration-300
                  ${filled ? level?.color ?? 'bg-gray-200' : 'bg-gray-200'}
                `}
              />
            );
          })}
        </div>
      </div>

      {/* ── Rule Checklist ── */}
      <div className="space-y-1.5">
        {evaluated.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2">
            {rule.passed ? (
              <CheckCircle2
                size={15}
                className="text-green-500 flex-shrink-0 transition-colors duration-200"
              />
            ) : (
              <XCircle
                size={15}
                className={`flex-shrink-0 transition-colors duration-200 ${password.length > 0 ? 'text-red-400' : 'text-gray-300'
                  }`}
              />
            )}
            <span
              className={`text-xs transition-colors duration-200 ${rule.passed
                  ? 'text-green-700 font-medium'
                  : password.length > 0
                    ? 'text-gray-600'
                    : 'text-gray-400'
                }`}
            >
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
