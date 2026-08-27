import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { sanitizeDownloadFileName } from '../registration-documents/document-storage.service.js';
import { internalLogisticsService } from './internal-logistics.service.js';
import {
  haderDriverSchema,
  haderTruckSchema,
  logisticsDocumentTypeSchema,
  logisticsEntitySchema,
  logisticsIdSchema,
  logisticsListSchema,
  transporterCostSchema,
  transporterSchema,
  updateHaderDriverSchema,
  updateHaderTruckSchema,
  updateTransporterCostSchema,
  updateTransporterSchema,
} from './internal-logistics.validation.js';

export class InternalLogisticsController {
  async transporters(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        transporters: await internalLogisticsService.listTransporters(
          logisticsListSchema.parse(req.query),
        ),
      },
    });
  }
  async createTransporter(req: SalesAuthenticatedRequest, res: Response) {
    res
      .status(201)
      .json({
        success: true,
        data: {
          transporter: await internalLogisticsService.createTransporter(
            transporterSchema.parse(req.body),
            user(req),
          ),
        },
      });
  }
  async updateTransporter(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        transporter: await internalLogisticsService.updateTransporter(
          id(req),
          defined(updateTransporterSchema.parse(req.body)),
          user(req),
        ),
      },
    });
  }
  async costs(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        costs: await internalLogisticsService.listCosts(logisticsListSchema.parse(req.query)),
      },
    });
  }
  async createCost(req: SalesAuthenticatedRequest, res: Response) {
    res
      .status(201)
      .json({
        success: true,
        data: {
          cost: await internalLogisticsService.createCost(
            transporterCostSchema.parse(req.body),
            user(req),
          ),
        },
      });
  }
  async updateCost(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        cost: await internalLogisticsService.updateCost(
          id(req),
          defined(updateTransporterCostSchema.parse(req.body)),
          user(req),
        ),
      },
    });
  }
  async trucks(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        trucks: await internalLogisticsService.listTrucks(logisticsListSchema.parse(req.query)),
      },
    });
  }
  async createTruck(req: SalesAuthenticatedRequest, res: Response) {
    res
      .status(201)
      .json({
        success: true,
        data: {
          truck: await internalLogisticsService.createTruck(
            haderTruckSchema.parse(req.body),
            user(req),
          ),
        },
      });
  }
  async updateTruck(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        truck: await internalLogisticsService.updateTruck(
          id(req),
          defined(updateHaderTruckSchema.parse(req.body)),
          user(req),
        ),
      },
    });
  }
  async drivers(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        drivers: await internalLogisticsService.listDrivers(logisticsListSchema.parse(req.query)),
      },
    });
  }
  async createDriver(req: SalesAuthenticatedRequest, res: Response) {
    res
      .status(201)
      .json({
        success: true,
        data: {
          driver: await internalLogisticsService.createDriver(
            haderDriverSchema.parse(req.body),
            user(req),
          ),
        },
      });
  }
  async updateDriver(req: SalesAuthenticatedRequest, res: Response) {
    res.json({
      success: true,
      data: {
        driver: await internalLogisticsService.updateDriver(
          id(req),
          defined(updateHaderDriverSchema.parse(req.body)),
          user(req),
        ),
      },
    });
  }
  async reference(_req: SalesAuthenticatedRequest, res: Response) {
    res.json({ success: true, data: await internalLogisticsService.referenceData() });
  }
  async upload(req: SalesAuthenticatedRequest, res: Response) {
    if (!Buffer.isBuffer(req.body))
      throw new AppError('Document file is required.', 400, 'DOCUMENT_FILE_REQUIRED');
    const raw = req.headers['x-file-name'];
    const fileName = Array.isArray(raw) ? raw[0] : raw;
    if (!fileName)
      throw new AppError('Document file name is required.', 400, 'DOCUMENT_FILE_NAME_REQUIRED');
    const attachment = await internalLogisticsService.uploadAttachment(
      entityType(req),
      id(req),
      logisticsDocumentTypeSchema.parse(req.params.documentType),
      fileName,
      req.headers['content-type'],
      req.body,
      user(req),
    );
    res.status(201).json({ success: true, data: { attachment } });
  }
  async document(req: SalesAuthenticatedRequest, res: Response) {
    const document = await internalLogisticsService.getAttachment(
      entityType(req),
      id(req),
      logisticsIdSchema.parse(req.params.documentId),
    );
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', String(document.size));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeDownloadFileName(document.fileName)}"`,
    );
    document.stream.pipe(res);
  }
}
export const internalLogisticsController = new InternalLogisticsController();
function user(req: SalesAuthenticatedRequest) {
  if (!req.salesUser)
    throw new AppError('Internal authentication is required.', 401, 'INTERNAL_AUTH_REQUIRED');
  return req.salesUser;
}
function id(req: SalesAuthenticatedRequest) {
  return logisticsIdSchema.parse(req.params.id);
}
function entityType(req: SalesAuthenticatedRequest) {
  const raw = req.params.entityType;
  return logisticsEntitySchema.parse((Array.isArray(raw) ? raw[0] : raw)?.toUpperCase());
}
function defined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
