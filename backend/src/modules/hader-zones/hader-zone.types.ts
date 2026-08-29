export type HaderZoneStatus = 'WITHIN_HADER_ZONE' | 'OUTSIDE_HADER_ZONE';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface HaderCityBoundary {
  id: string;
  name: string;
  isHaderEnabled: boolean;
  isActive: boolean;
  boundary: GeoJsonPolygon | null;
  boundaryStatus: 'CONFIGURED' | 'NOT_CONFIGURED';
  boundaryUpdatedAt: string | null;
  boundaryUpdatedBy: string | null;
}
