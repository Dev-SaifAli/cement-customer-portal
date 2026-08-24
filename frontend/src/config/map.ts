export const mapConfig = {
  defaultCenter: {
    latitude: 23.8859,
    longitude: 45.0792,
  },
  defaultZoom: 5,
  selectedZoom: 14,
  tileLayer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  geolocation: {
    timeout: 10000,
    maximumAge: 60000,
  },
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function isValidCoordinates(coordinates: Coordinates | null | undefined) {
  return Boolean(
    coordinates &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180,
  );
}

export function formatCoordinates(coordinates: Coordinates) {
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}
