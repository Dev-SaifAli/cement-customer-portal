import { LoaderCircle } from 'lucide-react';

export function AppLoadingScreen({ label = 'Preparing your workspace' }: { label?: string }) {
  return (
    <div className="app-loading-screen" role="status" aria-live="polite" aria-label={label}>
      <div className="app-loading-mark" aria-hidden="true">A</div>
      <div className="app-loading-copy">
        <strong>AlSafwa Cement Portal</strong>
        <span>{label}</span>
      </div>
      <LoaderCircle className="app-loading-spinner" size={22} aria-hidden="true" />
    </div>
  );
}
