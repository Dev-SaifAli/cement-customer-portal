import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { SalesAuthenticatedRequest } from '../sales-auth/sales-auth.types.js';
import { sanitizeDownloadFileName } from './document-storage.service.js';
import { registrationDocumentService } from './registration-document.service.js';
import {
  registrationDocumentParamsSchema,
  salesDocumentParamsSchema,
  salesDocumentQuerySchema,
  uploadRegistrationDocumentHeadersSchema,
} from './registration-document.validation.js';

export class RegistrationDocumentController {
  async upload(request: Request, response: Response) {
    const { id, documentType } = registrationDocumentParamsSchema.parse(request.params);
    const headers = uploadRegistrationDocumentHeadersSchema.parse(request.headers);

    if (!Buffer.isBuffer(request.body)) {
      throw new AppError('Document file is required.', 400, 'DOCUMENT_FILE_REQUIRED');
    }

    const registration = await registrationDocumentService.uploadDocument({
      registrationId: id,
      documentType,
      fileName: headers['x-file-name'],
      mimeType: headers['content-type'],
      buffer: request.body,
    });

    response.status(200).json({ success: true, registration });
  }

  async streamForSales(request: SalesAuthenticatedRequest, response: Response) {
    const { id, documentId } = salesDocumentParamsSchema.parse(request.params);
    const { download } = salesDocumentQuerySchema.parse(request.query);
    const document = await registrationDocumentService.getSalesDocument(id, documentId);
    const safeFileName = sanitizeDownloadFileName(document.fileName);

    response.setHeader('Content-Type', document.fileType);
    response.setHeader('Content-Length', String(document.streamSize));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${safeFileName}"`,
    );

    document.stream.pipe(response);
  }
}

export const registrationDocumentController = new RegistrationDocumentController();
