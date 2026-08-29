import { describe, expect, it } from 'vitest';
import { pointInPolygon } from './hader-zone.service.js';

const boundary = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [39, 21],
      [40, 21],
      [40, 22],
      [39, 22],
      [39, 21],
    ],
  ],
};

describe('Hader delivery boundary geometry', () => {
  it('accepts a point inside the configured polygon', () => {
    expect(pointInPolygon({ latitude: 21.5, longitude: 39.5 }, boundary)).toBe(true);
  });

  it('rejects a point outside the configured polygon', () => {
    expect(pointInPolygon({ latitude: 23, longitude: 41 }, boundary)).toBe(false);
  });

  it('treats a boundary-edge point as covered', () => {
    expect(pointInPolygon({ latitude: 21.5, longitude: 39 }, boundary)).toBe(true);
  });
});
