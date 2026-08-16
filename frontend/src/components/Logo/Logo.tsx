import { Building2 } from 'lucide-react';
import './Logo.css';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`logo-mark logo-mark--${size}`}>
      <span className="logo-glyph">
        <Building2 strokeWidth={1.75} />
      </span>
      <div className="logo-text-block">
        <div className="logo-word">ALSAFWA</div>
        <div className="logo-sub">Cement Company</div>
      </div>
    </div>
  );
}
