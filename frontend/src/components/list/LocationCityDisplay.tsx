export function LocationCityDisplay({ city }: { city: string | null | undefined }) {
  return <span className="whitespace-nowrap">{city?.trim() || <>&mdash;</>}</span>;
}

export function getShipToCity(value: {
  fulfilmentType?: 'DELIVERY' | 'PICKUP';
  fulfilment?: 'DELIVERY' | 'PICKUP';
  shipTo?: { city?: string | null } | null;
  deliveryLocation?: { city?: string | null } | null;
  pickupLocation?: { city?: string | null } | null;
}) {
  const fulfilment = value.fulfilmentType ?? value.fulfilment;
  return fulfilment === 'PICKUP'
    ? value.pickupLocation?.city ?? null
    : value.shipTo?.city ?? value.deliveryLocation?.city ?? null;
}
