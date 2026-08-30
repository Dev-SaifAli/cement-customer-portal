import { RefreshCw } from 'lucide-react';

export function SessionRestoreError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="customer-portal customer-page-bg customer-text flex min-h-screen items-center justify-center px-4 font-['Manrope',system-ui,sans-serif]">
      <div className="customer-card w-full max-w-md rounded-xl border p-6 text-center">
        <h1 className="text-lg font-bold">Unable to restore your session</h1>
        <p className="customer-muted mt-2 text-sm">
          Check your connection and try again. You have not been signed out.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="customer-primary-bg mt-5 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
        >
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    </div>
  );
}
