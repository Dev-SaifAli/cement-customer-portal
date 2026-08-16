import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  if (!open) return null;
  return (
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <h2 id="modal-title">{title}</h2>
          <Button variant="secondary" aria-label="Close modal" onClick={onClose}>
            Close
          </Button>
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}
