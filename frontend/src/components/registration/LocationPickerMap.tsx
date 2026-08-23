import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, LocateFixed, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { mapConfig, type Coordinates } from '../../config/map';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetinaUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

type LocationPickerMapProps = {
  initialCoordinates?: Coordinates | undefined;
  locationLabel?: string | undefined;
  onCancel: () => void;
  onConfirm: (coordinates: Coordinates) => void;
};

export function LocationPickerMap({
  initialCoordinates,
  locationLabel,
  onCancel,
  onConfirm,
}: LocationPickerMapProps) {
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(
    initialCoordinates ?? null,
  );
  const [mapCenter, setMapCenter] = useState<Coordinates>(
    initialCoordinates ?? mapConfig.defaultCenter,
  );
  const [geoStatus, setGeoStatus] = useState('');
  const [locating, setLocating] = useState(false);

  const center = useMemo<[number, number]>(
    () => [mapCenter.latitude, mapCenter.longitude],
    [mapCenter],
  );

  const handleUseCurrentLocation = () => {
    setGeoStatus('');

    if (!navigator.geolocation) {
      setGeoStatus(
        'Current location is not available in this browser or connection. You can still select the site manually on the map.',
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: toCoordinatePrecision(position.coords.latitude),
          longitude: toCoordinatePrecision(position.coords.longitude),
        };

        setMapCenter(coordinates);
        setSelectedCoordinates(coordinates);
        setLocating(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can still select the site manually on the map.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Current location is unavailable. Please select the site manually.'
              : 'Current location timed out. Please select the site manually.';

        setGeoStatus(message);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: mapConfig.geolocation.maximumAge,
        timeout: mapConfig.geolocation.timeout,
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Select delivery location on map"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5dfe5] px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-[#54247a]">
              <MapPin size={20} />
              <h2 className="text-lg font-bold">Select Delivery Location</h2>
            </div>
            <p className="mt-1 text-sm text-[#6c666c]">
              Click anywhere on the map or drag the marker to the exact delivery point
              {locationLabel ? ` for ${locationLabel}` : ''}.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close map"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-[#cfc6d0] bg-white px-4 py-2 text-sm font-semibold text-[#625c62] hover:bg-[#faf7fb] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LocateFixed size={17} />
              {locating ? 'Finding location...' : 'Use My Current Location'}
            </button>

            <div className="text-sm font-medium text-[#625c62]">
              {selectedCoordinates ? 'Map location selected' : 'No map point selected yet.'}
            </div>
          </div>

          {geoStatus && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{geoStatus}</span>
            </div>
          )}

          <div className="h-[380px] overflow-hidden rounded-xl border border-[#d6cbd7] sm:h-[500px]">
            <MapContainer
              center={center}
              zoom={initialCoordinates ? mapConfig.selectedZoom : mapConfig.defaultZoom}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution={mapConfig.tileLayer.attribution}
                url={mapConfig.tileLayer.url}
              />
              <MapInteractionHandler onSelect={setSelectedCoordinates} />
              <MapCenterSync center={center} zoom={mapConfig.selectedZoom} />
              {selectedCoordinates && (
                <Marker
                  draggable
                  position={[selectedCoordinates.latitude, selectedCoordinates.longitude]}
                  eventHandlers={{
                    dragend: (event) => {
                      const marker = event.target as L.Marker;
                      const next = marker.getLatLng();
                      setSelectedCoordinates({
                        latitude: toCoordinatePrecision(next.lat),
                        longitude: toCoordinatePrecision(next.lng),
                      });
                    },
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#e5dfe5] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[#cfc6d0] px-5 py-2.5 text-sm font-semibold text-[#625c62] hover:bg-[#faf7fb]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedCoordinates && onConfirm(selectedCoordinates)}
            disabled={!selectedCoordinates}
            className="rounded-md bg-[#54247a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#472066] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use This Location
          </button>
        </div>
      </div>
    </div>
  );
}

function MapInteractionHandler({ onSelect }: { onSelect: (coordinates: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: toCoordinatePrecision(event.latlng.lat),
        longitude: toCoordinatePrecision(event.latlng.lng),
      });
    },
  });

  return null;
}

function MapCenterSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);

  return null;
}

function toCoordinatePrecision(value: number) {
  return Number(value.toFixed(6));
}
