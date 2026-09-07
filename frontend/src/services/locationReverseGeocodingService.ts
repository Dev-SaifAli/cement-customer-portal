import type { Coordinates } from '../config/map';

export interface NormalizedLocationData extends Coordinates {
  locationName?: string | undefined;
  country?: string | undefined;
  region?: string | undefined;
  city?: string | undefined;
  district?: string | undefined;
  street?: string | undefined;
  postalCode?: string | undefined;
  formattedAddress?: string | undefined;
}

interface NominatimReverseResponse {
  name?: string;
  display_name?: string;
  address?: {
    country?: string;
    state?: string;
    state_district?: string;
    region?: string;
    province?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    locality?: string;
    county?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    hamlet?: string;
    amenity?: string;
    building?: string;
    shop?: string;
    office?: string;
    tourism?: string;
    industrial?: string;
    road?: string;
    pedestrian?: string;
    residential?: string;
    house_number?: string;
    postcode?: string;
  };
}

export async function reverseGeocodeLocation(
  coordinates: Coordinates,
  signal?: AbortSignal,
): Promise<NormalizedLocationData> {
  const latitude = toCoordinateNumber(coordinates.latitude);
  const longitude = toCoordinateNumber(coordinates.longitude);

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    addressdetails: '1',
    zoom: '18',
  });

  const requestInit: RequestInit = {
    headers: {
      accept: 'application/json',
    },
  };

  if (signal) {
    requestInit.signal = signal;
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, requestInit);

  if (!response.ok) {
    throw new Error('Unable to look up the selected address.');
  }

  const data = (await response.json()) as NominatimReverseResponse;
  const address = data.address ?? {};
  const region = clean(address.state ?? address.province ?? address.region ?? address.state_district);
  const city = clean(
    address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.locality ??
      address.county,
  );
  const district = clean(
    address.suburb ?? address.neighbourhood ?? address.quarter ?? address.locality ?? address.hamlet,
  );
  const street = [address.house_number, address.road ?? address.pedestrian ?? address.residential]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    latitude,
    longitude,
    locationName: resolveLocationName(data, city, district, region),
    country: clean(address.country),
    region,
    city,
    district,
    street: clean(street),
    postalCode: clean(address.postcode),
    formattedAddress: clean(data.display_name),
  };
}

function resolveLocationName(
  data: NominatimReverseResponse,
  city: string | undefined,
  district: string | undefined,
  region: string | undefined,
) {
  const address = data.address ?? {};
  const providerName = clean(
    data.name ??
      address.amenity ??
      address.shop ??
      address.office ??
      address.tourism ??
      address.building ??
      address.industrial ??
      address.locality ??
      address.hamlet,
  );

  return (
    providerName ??
    district ??
    (city ? `${city} Delivery Site` : undefined) ??
    (region ? `${region} Delivery Site` : 'Selected Delivery Location')
  );
}

function toCoordinateNumber(value: number) {
  return Number(value.toFixed(6));
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
