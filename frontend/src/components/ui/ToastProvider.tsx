import { CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ToastMessage { id: number; message: string }
interface ToastContextValue { success: (message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const dismiss = useCallback((id: number) => setMessages((current) => current.filter((item) => item.id !== id)), []);
  const success = useCallback((message: string) => {
    const id = nextToastId++;
    setMessages((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  useEffect(() => {
    const listener = (event: Event) => success((event as CustomEvent<string>).detail);
    window.addEventListener('alsafwa:operation-success', listener);
    return () => window.removeEventListener('alsafwa:operation-success', listener);
  }, [success]);

  const value = useMemo(() => ({ success }), [success]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-region" aria-live="polite" aria-label="Operation notifications">
        {messages.map((item) => (
          <div className="app-toast" key={item.id} role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{item.message}</span>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
