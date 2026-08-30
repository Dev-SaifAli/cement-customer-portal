import { useEffect, type ReactNode } from 'react';
import { Button } from './Button';
export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div
      className="ui-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="ui-modal__header">
          <h2 id="modal-title">{title}</h2>
          <Button variant="secondary" aria-label="Close modal" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
