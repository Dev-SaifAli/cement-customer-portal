import { StatusBadge, type StatusTone } from '../list/StatusBadge';

const tones: Record<string, StatusTone> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'default',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CONVERTED_TO_SHIPMENT: 'success',
  CREATED: 'secondary',
  ASSIGNED: 'default',
  WAITING: 'secondary',
  NOTIFIED: 'default',
  AT_GATE: 'default',
  LOADING: 'warning',
  LOADED: 'success',
  DISPATCHED: 'default',
  IN_TRANSIT: 'default',
  DELIVERED: 'success',
  CLOSED: 'secondary',
  CANCELLED: 'destructive',
  AVAILABLE: 'success',
  BUSY: 'warning',
  FULL: 'destructive',
  INACTIVE: 'secondary',
};

export function HaderStatusBadge({ status }: { status: string }) {
  return <StatusBadge label={formatHaderStatus(status)} tone={tones[status] ?? 'secondary'} />;
}

export function formatHaderStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
