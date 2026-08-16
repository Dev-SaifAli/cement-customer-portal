import type { ReactNode } from 'react';
import { Award, ShieldCheck } from 'lucide-react';
import Logo from '../Logo/Logo';
import LoginCarousel from './LoginCarousel';
import './AuthLayout.css';

interface VisualContent {
  badge: string;
  icon: ReactNode;
  heading: string;
  copy: string;
}
interface AuthLayoutProps {
  children: ReactNode;
  visual?: VisualContent;
  activeDot?: 0 | 1 | 2;
}

export const visualPresets: Record<'login' | 'forgotPassword', VisualContent> = {
  login: {
    badge: 'Industry Excellence',
    icon: <Award size={13} />,
    heading: 'Pioneering Sustainable Construction Solutions',
    copy: "AlSafwa Cement continues to lead the industry in sustainable practices, ensuring high-quality materials for the Kingdom's most ambitious structural projects.",
  },
  forgotPassword: {
    badge: 'Account Security',
    icon: <ShieldCheck size={13} />,
    heading: 'Your Account, Protected at Every Step',
    copy: "We verify every request before any password change goes through, keeping your organization's account safe and under your control.",
  },
};

export default function AuthLayout({ children, visual = visualPresets.login }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <div className="auth-visual-side">
        <LoginCarousel>
          <DiamondPattern />
          <span className="visual-badge">
            {visual.icon}
            {visual.badge}
          </span>
          <h2 className="visual-heading">{visual.heading}</h2>
          <p className="visual-copy">{visual.copy}</p>
        </LoginCarousel>
      </div>
      <div className="auth-form-side">
        <div className="logo-wrap">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}

function DiamondPattern() {
  return (
    <svg
      className="visual-pattern"
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g opacity="0.14" stroke="#B79FD1" strokeWidth="1.4" fill="none">
        <rect x="80" y="120" width="180" height="340" transform="rotate(-8 170 290)" />
        <rect x="260" y="180" width="220" height="280" transform="rotate(6 370 320)" />
        <rect x="120" y="480" width="260" height="260" transform="rotate(-4 250 610)" />
        <rect x="340" y="500" width="200" height="220" transform="rotate(9 440 610)" />
      </g>
      <g opacity="0.08" stroke="#fff" strokeWidth="1" fill="none">
        <rect x="20" y="40" width="140" height="260" transform="rotate(-10 90 170)" />
        <rect x="400" y="620" width="160" height="200" transform="rotate(7 480 720)" />
      </g>
    </svg>
  );
}
