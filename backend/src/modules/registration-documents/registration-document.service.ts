import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { RegistrationDraft } from '../registrations/registration.types.js';
import { documentStorageService } from './document-storage.service.js';
import {
  registrationDocumentLabels,
  type RegistrationDocumentType,
} from './registration-document.constants.js';

export interface DocumentAccessDetails {
  documentType: RegistrationDocumentType;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string | null;
  stream: NodeJS.ReadableStream;
  streamSize: number;
}

export class RegistrationDocumentService {
  async uploadDocument(input: {
    registrationId: string;
    documentType: RegistrationDocumentType;
    fileName: string;
    mimeType?: string | undefined;
    buffer: Buffer;
  }): Promise<RegistrationDraft> {
    const draft = await this.getRegistrationDraft(input.registrationId);

    if (draft.status !== 'DRAFT') {
      throw new AppError(
        'Documents can only be uploaded while the registration is in draft.',
        409,
        'REGISTRATION_DOCUMENT_UPLOAD_NOT_ALLOWED',
      );
    }

    const storedFile = await documentStorageService.saveRegistrationDocument(input);
    const currentDocuments = toDocumentsRecord(draft.documents);
    const currentDocument = toDocumentRecord(currentDocuments[input.documentType]);
    const nextDocument = {
      ...currentDocument,
      documentType: input.documentType,
      documentLabel: registrationDocumentLabels[input.documentType],
      fileName: storedFile.originalFileName,
      fileSize: storedFile.size,
      fileType: storedFile.mimeType,
      uploadedAt: storedFile.uploadedAt,
      storageKey: storedFile.storageKey,
    };
    const nextDocuments = {
      ...currentDocuments,
      [input.documentType]: nextDocument,
    };

    const result = await pool.query(
      `update registration_drafts
       set documents = $2::jsonb,
           updated_at = now()
       where id = $1
       returning id, reference, status, current_step, company, contact, documents,
                 delivery_locations, administrator, submitted_at, created_at, updated_at`,
      [input.registrationId, JSON.stringify(nextDocuments)],
    );

    return mapRegistration(result.rows[0] as Record<string, unknown>);
  }

  async getSalesDocument(
    applicationId: string,
    documentType: RegistrationDocumentType,
  ): Promise<DocumentAccessDetails> {
    const draft = await this.getRegistrationDraft(applicationId);
    const documents = toDocumentsRecord(draft.documents);
    const document = toDocumentRecord(documents[documentType]);
    const storageKey = stringOrNull(document.storageKey);

    if (!storageKey) {
      throw new AppError('Document file was not found.', 404, 'DOCUMENT_FILE_NOT_FOUND');
    }

    const fileName = stringOrNull(document.fileName) ?? `${documentType}-document`;
    const fileType = stringOrNull(document.fileType) ?? 'application/octet-stream';
    const fileSize = typeof document.fileSize === 'number' ? document.fileSize : 0;
    const uploadedAt = stringOrNull(document.uploadedAt);
    const file = await documentStorageService.readRegistrationDocument(storageKey);

    return {
      documentType,
      fileName,
      fileType,
      fileSize,
      uploadedAt,
      stream: file.stream,
      streamSize: file.size,
    };
  }

  private async getRegistrationDraft(registrationId: string) {
    const result = await pool.query(
      `select id, status, documents
       from registration_drafts
       where id = $1
       limit 1`,
      [registrationId],
    );
    const draft = result.rows[0] as { id: string; status: string; documents: unknown } | undefined;

    if (!draft) {
      throw new AppError('Registration draft was not found.', 404, 'REGISTRATION_NOT_FOUND');
    }

    return draft;
  }
}

export const registrationDocumentService = new RegistrationDocumentService();

function toDocumentsRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDocumentRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mapRegistration(row: Record<string, unknown>): RegistrationDraft {
  return {
    id: String(row.id),
    reference: row.reference ? String(row.reference) : null,
    status: row.status as RegistrationDraft['status'],
    currentStep: Number(row.current_step),
    company: (row.company ?? {}) as Record<string, unknown>,
    contact: (row.contact ?? {}) as Record<string, unknown>,
    documents: safeDocuments((row.documents ?? {}) as Record<string, unknown>),
    deliveryLocations: (row.delivery_locations ?? []) as unknown[],
    administrator: safeAdministrator((row.administrator ?? {}) as Record<string, unknown>),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function safeAdministrator(administrator: Record<string, unknown>) {
  const { password: _password, confirmPassword: _confirmPassword, ...safe } = administrator;
  void _password;
  void _confirmPassword;
  return safe;
}

function safeDocuments(documents: Record<string, unknown>) {
  return Object.entries(documents).reduce<Record<string, unknown>>((safe, [documentId, value]) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      safe[documentId] = value;
      return safe;
    }

    const { storageKey: _storageKey, ...documentMetadata } = value as Record<string, unknown>;
    void _storageKey;
    safe[documentId] = documentMetadata;
    return safe;
  }, {});
}
