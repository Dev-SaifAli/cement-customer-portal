import { z } from 'zod';

export const shipmentPodIdSchema = z.uuid();
export const shipmentPodDocumentTypeSchema = z.enum(['DELIVERY_PHOTO', 'SIGNED_POD']);

export const createShipmentPodSchema = z
  .object({
    receiver: z.string().trim().min(1, 'Receiver is required.').max(200),
    deliveredQuantityTon: z.number().positive('Delivered quantity must be greater than zero.'),
    deliveryTime: z.iso.datetime({ offset: true }),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    evidence: z.string().trim().max(2000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if ((value.latitude == null) !== (value.longitude == null)) {
      context.addIssue({
        code: 'custom',
        path: ['latitude'],
        message: 'Both latitude and longitude are required when a delivery location is provided.',
      });
    }
  });

export const updateShipmentPodSchema = createShipmentPodSchema;

export type CreateShipmentPodInput = z.infer<typeof createShipmentPodSchema>;
export type ShipmentPodDocumentType = z.infer<typeof shipmentPodDocumentTypeSchema>;
