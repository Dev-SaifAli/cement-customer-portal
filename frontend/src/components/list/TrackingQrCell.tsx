import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/shadcn';

export function TrackingQrCell({
  documentType,
  reference,
  viewTo,
}: {
  documentType: 'ORDER' | 'CONTRACT';
  reference: string | null | undefined;
  viewTo?: string;
}) {
  if (!reference) return <span aria-label="Unavailable">&mdash;</span>;

  const label = documentType === 'ORDER' ? 'order' : 'contract';
  const payload = `ALSAFWA|${documentType}|${reference}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          title={`Show QR for ${label} ${reference}`}
          aria-label={`Show QR for ${label} ${reference}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--customer-text-secondary,var(--color-text-muted,#64748b))] transition hover:bg-[var(--customer-primary-soft,#f6f2fa)] hover:text-[var(--customer-primary,#54247a)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--customer-primary,#54247a)]"
        >
          <QrCode size={17} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{reference}</DialogTitle>
          <DialogDescription>{label === 'order' ? 'Order' : 'Contract'} tracking reference</DialogDescription>
        </DialogHeader>
        <div className="mx-auto rounded-md bg-white p-3">
          <QRCodeSVG value={payload} size={180} level="M" aria-label={`QR code for ${reference}`} />
        </div>
        {viewTo && (
          <DialogFooter>
            <Button asChild>
              <Link to={viewTo}>View</Link>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
