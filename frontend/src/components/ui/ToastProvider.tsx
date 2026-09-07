import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ToastMessage { id: number; message: string; tone: 'success' | 'error'; exiting?: boolean }
interface ToastContextValue { success: (message: string) => void; error: (message: string) => void }

const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const dismiss = useCallback((id: number) => {
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, exiting: true } : item)),
    );
    window.setTimeout(() => {
      setMessages((current) => current.filter((item) => item.id !== id));
    }, 180);
  }, []);
  const push = useCallback((message: string, tone: ToastMessage['tone']) => {
    const id = nextToastId++;
    setMessages((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);
  const success = useCallback((message: string) => push(message, 'success'), [push]);
  const error = useCallback((message: string) => push(message, 'error'), [push]);

  useEffect(() => {
    const listener = (event: Event) => success((event as CustomEvent<string>).detail);
    const errorListener = (event: Event) => error((event as CustomEvent<string>).detail);
    window.addEventListener('alsafwa:operation-success', listener);
    window.addEventListener('alsafwa:operation-error', errorListener);
    return () => {
      window.removeEventListener('alsafwa:operation-success', listener);
      window.removeEventListener('alsafwa:operation-error', errorListener);
    };
  }, [error, success]);

  const value = useMemo(() => ({ success, error }), [error, success]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="app-toast-region" aria-live="polite" aria-label="Operation notifications">
        {messages.map((item) => (
          <div className={`app-toast app-toast--${item.tone}${item.exiting ? ' app-toast--exit' : ''}`} key={item.id} role={item.tone === 'error' ? 'alert' : 'status'}>
            {item.tone === 'error' ? (
              <AlertCircle size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
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
