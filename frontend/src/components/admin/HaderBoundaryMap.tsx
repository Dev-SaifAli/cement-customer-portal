import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CalendarDays,
  CheckCircle2,
  Expand,
  Info,
  Pencil,
  Pentagon,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { mapConfig } from '../../config/map';
import type { GeoJsonPolygon } from '../../services/haderZoneService';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetinaUrl,
  iconUrl: markerIconUrl,
  markerShadowUrl,
});
type EditMode = 'view' | 'draw' | 'edit';

export function HaderBoundaryMap({
  cityName,
  initialBoundary,
  updatedAt,
  updatedBy,
  canEdit,
  busy,
  onSave,
  onClear,
  onClose,
}: {
  cityName: string;
  initialBoundary: GeoJsonPolygon | null;
  updatedAt: string | null;
  updatedBy: string | null;
  canEdit: boolean;
  busy: boolean;
  onSave: (boundary: GeoJsonPolygon) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const initialPoints = useMemo(
    () =>
      (initialBoundary?.coordinates[0] ?? [])
        .slice(0, -1)
        .map(([lng, lat]) => [lat ?? 0, lng ?? 0] as [number, number]),
    [initialBoundary],
  );
  const [points, setPoints] = useState<[number, number][]>(initialPoints);
  const [mode, setMode] = useState<EditMode>(initialBoundary ? 'view' : canEdit ? 'draw' : 'view');
  const [fitRequest, setFitRequest] = useState(0);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const save = () => {
    if (points.length < 3) return;
    const coordinates = points.map(([lat, lng]) => [lng, lat]);
    coordinates.push([...coordinates[0]!] as [number, number]);
    onSave({ type: 'Polygon', coordinates: [coordinates] });
  };
  const startDrawing = () => {
    setPoints([]);
    setMode('draw');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/35"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-hidden border-l border-[#e3e1e8] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="boundary-title"
      >
        <header className="flex items-start justify-between border-b border-[#e3e1e8] px-5 py-4">
          <div>
            <h2 id="boundary-title" className="text-lg font-bold text-[#1a1b23]">
              {cityName} Delivery Boundary
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Define the geographic area where Hader delivery pricing applies.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#64748b] hover:bg-[#f6f2fa]"
            aria-label="Close boundary editor"
          >
            <X size={19} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-[#e3e1e8] p-4">
          <Meta label="Boundary Status" icon={<CheckCircle2 size={15} />}>
            <span
              className={`inline-flex items-center gap-2 font-semibold ${initialBoundary ? 'text-[#0f8b5f]' : 'text-[#b45309]'}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${initialBoundary ? 'bg-[#0f8b5f]' : 'bg-amber-500'}`}
              />
              {initialBoundary ? 'Configured' : 'Not Configured'}
            </span>
          </Meta>
          <Meta label="Last Updated" icon={<CalendarDays size={15} />}>
            <span className="font-semibold text-[#1a1b23]">
              {updatedAt ? formatDateTime(updatedAt) : 'Not configured'}
            </span>
            {updatedAt && (
              <span className="block text-xs text-[#64748b]">
                by {updatedBy ?? 'Internal user'}
              </span>
            )}
          </Meta>
        </div>

        <div className="relative min-h-[300px] flex-1 bg-slate-100">
          <MapContainer
            center={[mapConfig.defaultCenter.latitude, mapConfig.defaultCenter.longitude]}
            zoom={mapConfig.defaultZoom}
            className="h-full min-h-[300px] w-full"
            zoomControl
          >
            <TileLayer
              url={mapConfig.tileLayer.url}
              attribution={mapConfig.tileLayer.attribution}
            />
            <MapViewport points={points} fitRequest={fitRequest} />
            <BoundaryClicks
              enabled={canEdit && mode !== 'view'}
              onAdd={(point) => setPoints((current) => [...current, point])}
            />
            {points.length >= 3 && (
              <Polygon
                positions={points}
                pathOptions={{
                  color: '#54247a',
                  fillColor: '#8c4ab2',
                  fillOpacity: 0.2,
                  weight: 3,
                }}
              />
            )}
            {points.map((position, index) => (
              <Marker
                key={`${index}-${position.join('-')}`}
                position={position}
                draggable={canEdit && mode === 'edit'}
                eventHandlers={{
                  dragend: (event) => {
                    const next = event.target.getLatLng();
                    setPoints((current) =>
                      current.map((point, pointIndex) =>
                        pointIndex === index ? [next.lat, next.lng] : point,
                      ),
                    );
                  },
                }}
              />
            ))}
          </MapContainer>
        </div>

        <div className="border-t border-[#e3e1e8] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3e1e8] px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Tool active={mode === 'draw'} onClick={startDrawing} icon={<Pentagon size={15} />}>
                  Draw Boundary
                </Tool>
              )}
              {canEdit && initialBoundary && (
                <Tool
                  active={mode === 'edit'}
                  onClick={() => {
                    setPoints(initialPoints);
                    setMode('edit');
                  }}
                  icon={<Pencil size={15} />}
                >
                  Edit Boundary
                </Tool>
              )}
              {canEdit && points.length > 0 && (
                <Tool danger onClick={() => setPoints([])} icon={<Trash2 size={15} />}>
                  Clear
                </Tool>
              )}
              <Tool onClick={() => setFitRequest((value) => value + 1)} icon={<Expand size={15} />}>
                Fit
              </Tool>
            </div>
            <span className="text-xs font-medium text-[#64748b]">
              Boundary Points: <strong className="text-[#1a1b23]">{points.length}</strong>
            </span>
          </div>
          {canEdit && mode !== 'view' && (
            <div className="m-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>
                Click the map to add boundary points.{' '}
                {mode === 'edit'
                  ? 'Drag points to adjust the zone.'
                  : 'Add at least three points to create the zone.'}
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e3e1e8] px-4 py-3">
            <div>
              {canEdit && initialBoundary && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClear}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-[#b42318] hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Clear Saved Boundary
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-lg border border-[#e3e1e8] px-4 text-sm font-semibold text-[#64748b] hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy || points.length < 3 || mode === 'view'}
                  onClick={save}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#54247a] px-4 text-sm font-semibold text-white hover:bg-[#472066] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {busy ? 'Saving…' : 'Save Boundary'}
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MapViewport({ points, fitRequest }: { points: [number, number][]; fitRequest: number }) {
  const map = useMap();
  useEffect(() => {
    window.setTimeout(() => map.invalidateSize(), 0);
    if (points.length > 0)
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: mapConfig.selectedZoom });
    else
      map.setView(
        [mapConfig.defaultCenter.latitude, mapConfig.defaultCenter.longitude],
        mapConfig.defaultZoom,
      );
  }, [map, fitRequest]);
  return null;
}

function BoundaryClicks({
  enabled,
  onAdd,
}: {
  enabled: boolean;
  onAdd: (point: [number, number]) => void;
}) {
  useMapEvents({ click: (event) => enabled && onAdd([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function Meta({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#e3e1e8] bg-[#f8fafc] p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#64748b]">
        {icon}
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Tool({
  children,
  icon,
  onClick,
  active = false,
  danger = false,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const styles = danger
    ? 'border-red-200 text-[#b42318] hover:bg-red-50'
    : active
      ? 'border-[#d7cbe0] bg-[#f6f2fa] text-[#54247a]'
      : 'border-[#e3e1e8] text-[#475569] hover:bg-[#f6f2fa] hover:text-[#54247a]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${styles}`}
    >
      {icon}
      {children}
    </button>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
