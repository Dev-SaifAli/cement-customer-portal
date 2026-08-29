import { z } from 'zod';

const coordinateSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const ringSchema = z
  .array(coordinateSchema)
  .min(4, 'A boundary needs at least three points and a closing point.')
  .superRefine((ring, context) => {
    const first = ring[0];
    const last = ring.at(-1);
    if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
      context.addIssue({
        code: 'custom',
        message: 'The boundary polygon must be closed.',
      });
    }
  });

export const geoJsonPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ringSchema).min(1).max(1),
});

export const haderCityIdSchema = z.string().uuid();

export const saveHaderBoundarySchema = z.object({ boundary: geoJsonPolygonSchema });

export const validateHaderZoneSchema = z.object({
  cityId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
