import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { sanitizeDownloadFileName } from '../registration-documents/document-storage.service.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { haderPodService } from './hader-pod.service.js';
import {
  createShipmentPodSchema,
  shipmentPodDocumentTypeSchema,
  shipmentPodIdSchema,
  updateShipmentPodSchema,
} from './hader-pod.validation.js';

export class HaderPodController {
  async create(request: SalesAuthenticatedRequest, response: Response) {
    const pod = await haderPodService.create(
      shipmentId(request),
      createShipmentPodSchema.parse(request.body),
      user(request),
    );
    response.status(201).json({ success: true, data: { pod } });
  }

  async show(request: SalesAuthenticatedRequest, response: Response) {
    response.json({
      success: true,
      data: { pod: await haderPodService.get(shipmentId(request)) },
    });
  }

  async update(request: SalesAuthenticatedRequest, response: Response) {
    const pod = await haderPodService.update(
      shipmentId(request),
      updateShipmentPodSchema.parse(request.body),
      user(request),
    );
    response.json({ success: true, data: { pod } });
  }

  async uploadDocument(request: SalesAuthenticatedRequest, response: Response) {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError('POD document file is required.', 400, 'POD_DOCUMENT_REQUIRED');
    }

    const rawFileName = request.headers['x-file-name'];
    const fileName = Array.isArray(rawFileName) ? rawFileName[0] : rawFileName;
    if (!fileName) {
      throw new AppError(
        'POD document file name is required.',
        400,
        'POD_DOCUMENT_FILE_NAME_REQUIRED',
      );
    }

    const document = await haderPodService.uploadDocument(
      shipmentId(request),
      shipmentPodDocumentTypeSchema.parse(request.params.documentType),
      fileName,
      request.headers['content-type'],
      request.body,
      user(request),
    );
    response.status(201).json({ success: true, data: { document } });
  }

  async document(request: SalesAuthenticatedRequest, response: Response) {
    const document = await haderPodService.getDocument(
      shipmentId(request),
      shipmentPodIdSchema.parse(request.params.documentId),
    );
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', String(document.size));
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeDownloadFileName(document.fileName)}"`,
    );
    document.stream.pipe(response);
  }
}

export const haderPodController = new HaderPodController();

function shipmentId(request: SalesAuthenticatedRequest) {
  return shipmentPodIdSchema.parse(request.params.shipmentId);
}

function user(request: SalesAuthenticatedRequest) {
  if (!request.salesUser) {
    throw new AppError('Internal authentication is required.', 401, 'HADER_AUTH_REQUIRED');
  }
  return request.salesUser;
}
