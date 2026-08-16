import { CheckCircle2 } from 'lucide-react';

export interface PasswordRule {
  key: string;
  label: string;
  test: (value: string) => boolean;
}
export const defaultRules: PasswordRule[] = [
  { key: 'len', label: 'At least 8 characters long', test: (value) => value.length >= 8 },
  {
    key: 'upper',
    label: 'Contains at least one uppercase letter',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: 'lower',
    label: 'Contains at least one lowercase letter',
    test: (value) => /[a-z]/.test(value),
  },
  { key: 'num', label: 'Contains at least one number', test: (value) => /[0-9]/.test(value) },
  {
    key: 'special',
    label: 'Contains at least one special character',
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];
const strengthColors = ['#DC2626', '#DC2626', '#B45309', '#B45309', '#0F8B5F'];
const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function usePasswordStrength(value: string, rules = defaultRules) {
  const met = rules.filter((rule) => rule.test(value)).length;
  return { met, color: strengthColors[met] ?? '#9CA3AF', label: strengthLabels[met] ?? '' };
}

export default function PasswordRequirements({
  value,
  rules = defaultRules,
}: {
  value: string;
  rules?: PasswordRule[];
}) {
  const { met, color, label } = usePasswordStrength(value, rules);
  return (
    <>
      {value.length > 0 && (
        <div className="pw-strength">
          <div className="pw-strength-bars">
            {[0, 1, 2, 3].map((index) => (
              <span key={index} style={{ background: index < met ? color : undefined }} />
            ))}
          </div>
          <div className="pw-strength-label" style={{ color }}>
            {label}
          </div>
        </div>
      )}
      <div className="req-box">
        <div className="req-title">Password Requirements</div>
        {rules.map((rule) => {
          const isMet = rule.test(value);
          return (
            <div key={rule.key} className={`req-item${isMet ? ' met' : ''}`}>
              <CheckCircle2 size={15} />
              {rule.label}
            </div>
          );
        })}
      </div>
    </>
  );
}
