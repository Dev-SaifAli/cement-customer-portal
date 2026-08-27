import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import {
  allowedRegistrationDocumentExtensions,
  allowedRegistrationDocumentMimeTypes,
  type RegistrationDocumentType,
} from './registration-document.constants.js';

const storageRoot = path.resolve(process.cwd(), env.FILE_STORAGE_LOCAL_PATH);

export interface StoredDocumentFile {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface DocumentReadStream {
  stream: NodeJS.ReadableStream;
  size: number;
}

export class DocumentStorageService {
  async saveRegistrationDocument(input: {
    registrationId: string;
    documentType: RegistrationDocumentType;
    fileName: string;
    mimeType?: string | undefined;
    buffer: Buffer;
  }): Promise<StoredDocumentFile> {
    const mimeType = this.validateFile(input.fileName, input.mimeType, input.buffer);

    const extension = path.extname(input.fileName).toLowerCase();
    const storageKey = path
      .join(
        'registrations',
        input.registrationId,
        'documents',
        `${input.documentType}-${randomUUID()}${extension}`,
      )
      .replaceAll(path.sep, '/');
    const targetPath = this.resolveStorageKey(storageKey);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.buffer, { flag: 'wx' });

    return {
      storageKey,
      originalFileName: sanitizeDownloadFileName(input.fileName),
      mimeType,
      size: input.buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async readRegistrationDocument(storageKey: string): Promise<DocumentReadStream> {
    return this.readStoredDocument(storageKey);
  }

  async saveCustomerFleetDocument(input: {
    customerAccountId: string;
    entityType: 'trucks' | 'drivers';
    entityId: string;
    documentType: string;
    fileName: string;
    mimeType?: string | undefined;
    buffer: Buffer;
  }): Promise<StoredDocumentFile> {
    const mimeType = this.validateFile(input.fileName, input.mimeType, input.buffer);
    const extension = path.extname(input.fileName).toLowerCase();
    const safeDocumentType = input.documentType.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const storageKey = path
      .join(
        'customers',
        input.customerAccountId,
        'fleet',
        input.entityType,
        input.entityId,
        `${safeDocumentType}-${randomUUID()}${extension}`,
      )
      .replaceAll(path.sep, '/');
    const targetPath = this.resolveStorageKey(storageKey);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.buffer, { flag: 'wx' });

    return {
      storageKey,
      originalFileName: sanitizeDownloadFileName(input.fileName),
      mimeType,
      size: input.buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async saveInternalLogisticsDocument(input: {
    entityType: 'transporters' | 'trucks' | 'drivers';
    entityId: string;
    documentType: string;
    fileName: string;
    mimeType?: string | undefined;
    buffer: Buffer;
  }): Promise<StoredDocumentFile> {
    const mimeType = this.validateFile(input.fileName, input.mimeType, input.buffer);
    const extension = path.extname(input.fileName).toLowerCase();
    const safeDocumentType = input.documentType.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const storageKey = path
      .join(
        'internal-logistics',
        input.entityType,
        input.entityId,
        `${safeDocumentType}-${randomUUID()}${extension}`,
      )
      .replaceAll(path.sep, '/');
    const targetPath = this.resolveStorageKey(storageKey);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.buffer, { flag: 'wx' });
    return {
      storageKey,
      originalFileName: sanitizeDownloadFileName(input.fileName),
      mimeType,
      size: input.buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async readStoredDocument(storageKey: string): Promise<DocumentReadStream> {
    const filePath = this.resolveStorageKey(storageKey);

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        throw new AppError('Document file was not found.', 404, 'DOCUMENT_FILE_NOT_FOUND');
      }

      return {
        stream: createReadStream(filePath),
        size: fileStat.size,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Document file was not found.', 404, 'DOCUMENT_FILE_NOT_FOUND');
    }
  }

  private validateFile(fileName: string, mimeType: string | undefined, buffer: Buffer) {
    if (buffer.length === 0) {
      throw new AppError('Document file is required.', 400, 'DOCUMENT_FILE_REQUIRED');
    }

    const extension = path.extname(fileName).toLowerCase();
    const normalizedMimeType = normalizeDocumentMimeType(mimeType, extension);

    if (
      !allowedRegistrationDocumentExtensions.includes(
        extension as (typeof allowedRegistrationDocumentExtensions)[number],
      ) ||
      !allowedRegistrationDocumentMimeTypes.includes(
        normalizedMimeType as (typeof allowedRegistrationDocumentMimeTypes)[number],
      )
    ) {
      throw new AppError(
        'Only PDF, JPG, and PNG documents are supported.',
        400,
        'DOCUMENT_FILE_TYPE_UNSUPPORTED',
      );
    }

    return normalizedMimeType;
  }

  private resolveStorageKey(storageKey: string) {
    if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes('..')) {
      throw new AppError('Document file was not found.', 404, 'DOCUMENT_FILE_NOT_FOUND');
    }

    const resolvedPath = path.resolve(storageRoot, storageKey);
    const relativePath = path.relative(storageRoot, resolvedPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new AppError('Document file was not found.', 404, 'DOCUMENT_FILE_NOT_FOUND');
    }

    return resolvedPath;
  }
}

export const documentStorageService = new DocumentStorageService();

export function sanitizeDownloadFileName(fileName: string) {
  const normalized = path
    .basename(fileName)
    .replace(/[^\w .()-]/g, '_')
    .trim();
  return normalized || 'document';
}

function normalizeDocumentMimeType(mimeType: string | undefined, extension: string) {
  const normalized = mimeType?.split(';')[0]?.trim().toLowerCase();

  if (
    normalized &&
    normalized !== 'application/octet-stream' &&
    allowedRegistrationDocumentMimeTypes.includes(
      normalized as (typeof allowedRegistrationDocumentMimeTypes)[number],
    )
  ) {
    return normalized;
  }

  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';

  return normalized ?? '';
}
