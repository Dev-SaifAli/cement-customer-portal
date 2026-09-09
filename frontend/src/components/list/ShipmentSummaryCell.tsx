import { Link } from 'react-router-dom';

export interface ShipmentListSummary {
  count: number;
  firstShipment: { id: string; shipmentNumber: string | null } | null;
}

export function ShipmentSummaryCell({
  summary,
  routeBase,
}: {
  summary: ShipmentListSummary | null | undefined;
  routeBase?: string;
}) {
  if (!summary?.count || !summary.firstShipment?.shipmentNumber) return <span>&mdash;</span>;

  const content = (
    <>
      {summary.firstShipment.shipmentNumber}
      {summary.count > 1 ? ` +${summary.count - 1}` : ''}
    </>
  );

  if (!routeBase) return <span className="whitespace-nowrap font-medium">{content}</span>;

  return (
    <Link
      to={`${routeBase}/${summary.firstShipment.id}`}
      onClick={(event) => event.stopPropagation()}
      className="whitespace-nowrap font-medium text-[var(--customer-primary,#54247a)] hover:underline"
    >
      {content}
    </Link>
  );
}
