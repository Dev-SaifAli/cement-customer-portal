import './Logo.css';
import companyLogo from '../../../../frontend/public/favicon.png';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`logo-mark logo-mark--${size}`}>
      <img className="logo-image" src={companyLogo} alt="AlSafwa Cement Company" />
    </div>
  );
}
