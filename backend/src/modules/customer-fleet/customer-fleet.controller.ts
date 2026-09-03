import type { Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { sanitizeDownloadFileName } from '../registration-documents/document-storage.service.js';
import { customerFleetService } from './customer-fleet.service.js';
import {
  createDriverSchema,
  createTruckSchema,
  driverDocumentTypeSchema,
  fleetEntityIdSchema,
  fleetListQuerySchema,
  truckDocumentTypeSchema,
  updateDriverSchema,
  updateTruckSchema,
} from './customer-fleet.validation.js';

export class CustomerFleetController {
  async listTrucks(request: CustomerAuthenticatedRequest, response: Response) {
    const result = await customerFleetService.listTrucks(
      requireFleetUser(request),
      fleetListQuerySchema.parse(request.query),
    );
    response.json({ success: true, data: { trucks: result.items, pagination: result.pagination } });
  }
  async createTruck(request: CustomerAuthenticatedRequest, response: Response) {
    const truck = await customerFleetService.createTruck(
      requireFleetUser(request),
      createTruckSchema.parse(request.body),
    );
    response.status(201).json({ success: true, data: { truck } });
  }
  async updateTruck(request: CustomerAuthenticatedRequest, response: Response) {
    const truck = await customerFleetService.updateTruck(
      requireFleetUser(request),
      getId(request),
      updateTruckSchema.parse(request.body),
    );
    response.json({ success: true, data: { truck } });
  }
  async listDrivers(request: CustomerAuthenticatedRequest, response: Response) {
    const result = await customerFleetService.listDrivers(
      requireFleetUser(request),
      fleetListQuerySchema.parse(request.query),
    );
    response.json({
      success: true,
      data: { drivers: result.items, pagination: result.pagination },
    });
  }
  async createDriver(request: CustomerAuthenticatedRequest, response: Response) {
    const driver = await customerFleetService.createDriver(
      requireFleetUser(request),
      createDriverSchema.parse(request.body),
    );
    response.status(201).json({ success: true, data: { driver } });
  }
  async updateDriver(request: CustomerAuthenticatedRequest, response: Response) {
    const driver = await customerFleetService.updateDriver(
      requireFleetUser(request),
      getId(request),
      updateDriverSchema.parse(request.body),
    );
    response.json({ success: true, data: { driver } });
  }
  async uploadTruckDocument(request: CustomerAuthenticatedRequest, response: Response) {
    const attachment = await this.upload(
      request,
      'TRUCK',
      truckDocumentTypeSchema.parse(request.params.documentType),
    );
    response.status(201).json({ success: true, data: { attachment } });
  }
  async uploadDriverDocument(request: CustomerAuthenticatedRequest, response: Response) {
    const attachment = await this.upload(
      request,
      'DRIVER',
      driverDocumentTypeSchema.parse(request.params.documentType),
    );
    response.status(201).json({ success: true, data: { attachment } });
  }
  async streamTruckDocument(request: CustomerAuthenticatedRequest, response: Response) {
    await this.stream(request, response, 'TRUCK');
  }
  async streamDriverDocument(request: CustomerAuthenticatedRequest, response: Response) {
    await this.stream(request, response, 'DRIVER');
  }
  private async upload(
    request: CustomerAuthenticatedRequest,
    entityType: 'TRUCK' | 'DRIVER',
    documentType: string,
  ) {
    if (!Buffer.isBuffer(request.body))
      throw new AppError('Document file is required.', 400, 'DOCUMENT_FILE_REQUIRED');
    const rawName = request.headers['x-file-name'];
    const fileName = Array.isArray(rawName) ? rawName[0] : rawName;
    if (!fileName)
      throw new AppError('Document file name is required.', 400, 'DOCUMENT_FILE_NAME_REQUIRED');
    return customerFleetService.uploadAttachment(requireFleetUser(request), {
      entityType,
      entityId: getId(request),
      documentType,
      fileName,
      mimeType: request.headers['content-type'],
      buffer: request.body,
    });
  }
  private async stream(
    request: CustomerAuthenticatedRequest,
    response: Response,
    entityType: 'TRUCK' | 'DRIVER',
  ) {
    const documentId = fleetEntityIdSchema.parse(request.params.documentId);
    const document = await customerFleetService.getAttachment(
      requireFleetUser(request),
      entityType,
      getId(request),
      documentId,
    );
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Length', String(document.streamSize));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeDownloadFileName(document.fileName)}"`,
    );
    document.stream.pipe(response);
  }
}

export const customerFleetController = new CustomerFleetController();
function requireFleetUser(request: CustomerAuthenticatedRequest) {
  const user = request.customerUser;
  if (!user)
    throw new AppError('Customer authentication is required.', 401, 'CUSTOMER_AUTH_REQUIRED');
  if (user.role !== 'CUSTOMER_ADMIN') {
    throw new AppError(
      'Fleet management access is required.',
      403,
      'CUSTOMER_FLEET_ACCESS_REQUIRED',
    );
  }
  return user;
}
function getId(request: CustomerAuthenticatedRequest) {
  return fleetEntityIdSchema.parse(request.params.id);
}
