import bcrypt from 'bcryptjs';
import { pool } from '../../database/pool.js';
import { AppError } from '../../errors/app-error.js';
import type { RegistrationDraft } from './registration.types.js';
import type { UpdateRegistrationInput } from './registration.validation.js';

const mapRegistration = (
  row: Record<string, unknown>,
  options: { includeStorageKey?: boolean } = {},
): RegistrationDraft => ({
  id: String(row.id),
  reference: row.reference ? String(row.reference) : null,
  status: row.status as RegistrationDraft['status'],
  currentStep: Number(row.current_step),
  company: (row.company ?? {}) as Record<string, unknown>,
  contact: (row.contact ?? {}) as Record<string, unknown>,
  documents: options.includeStorageKey
    ? ((row.documents ?? {}) as Record<string, unknown>)
    : safeDocuments((row.documents ?? {}) as Record<string, unknown>),
  deliveryLocations: (row.delivery_locations ?? []) as unknown[],
  administrator: (row.administrator ?? {}) as Record<string, unknown>,
  hasAdminPassword: Boolean(row.admin_password_hash),
  submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : null,
  createdAt: new Date(String(row.created_at)).toISOString(),
  updatedAt: new Date(String(row.updated_at)).toISOString(),
});

const safeAdministrator = (administrator?: Record<string, unknown>) => {
  if (!administrator) return undefined;
  const { password: _password, confirmPassword: _confirmPassword, ...safe } = administrator;
  void _password;
  void _confirmPassword;
  return safe;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const saudiMobilePattern = /^\+9665\d{8}$/;

const isFutureDate = (date: unknown) => {
  if (typeof date !== 'string' || !date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const submittedDate = new Date(`${date}T00:00:00`);

  return !Number.isNaN(submittedDate.getTime()) && submittedDate > today;
};

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const isValidOptionalLatitude = (value: unknown) =>
  value === undefined || (typeof value === 'number' && value >= -90 && value <= 90);
const isValidOptionalLongitude = (value: unknown) =>
  value === undefined || (typeof value === 'number' && value >= -180 && value <= 180);

export class RegistrationService {
  async createDraft(input: UpdateRegistrationInput = {}) {
    const administrator = safeAdministrator(input.administrator);
    const password = input.administrator?.password;
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const result = await pool.query(
      `insert into registration_drafts (
         current_step,
         company,
         contact,
         documents,
         delivery_locations,
         administrator,
         admin_password_hash
       )
       values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7)
       returning *`,
      [
        input.currentStep ?? 1,
        JSON.stringify(input.company ?? {}),
        JSON.stringify(input.contact ?? {}),
        JSON.stringify(input.documents ?? {}),
        input.deliveryLocations ? JSON.stringify(input.deliveryLocations) : JSON.stringify([]),
        JSON.stringify(administrator ?? {}),
        passwordHash,
      ],
    );

    return mapRegistration(result.rows[0]);
  }

  async getDraft(id: string) {
    const result = await pool.query('select * from registration_drafts where id = $1', [id]);
    const draft = result.rows[0];

    if (!draft) {
      throw new AppError('Registration draft was not found.', 404, 'REGISTRATION_NOT_FOUND');
    }

    return mapRegistration(draft);
  }

  private async getInternalDraft(id: string) {
    const result = await pool.query('select * from registration_drafts where id = $1', [id]);
    const draft = result.rows[0];

    if (!draft) {
      throw new AppError('Registration draft was not found.', 404, 'REGISTRATION_NOT_FOUND');
    }

    return mapRegistration(draft, { includeStorageKey: true });
  }

  async updateDraft(id: string, input: UpdateRegistrationInput) {
    const current = await this.getDraft(id);
    const currentDatabaseResult = await pool.query(
      'select documents from registration_drafts where id = $1',
      [id],
    );
    const mergedDocuments = mergeDocuments(
      (currentDatabaseResult.rows[0]?.documents ?? {}) as Record<string, unknown>,
      input.documents,
    );
    const administrator = safeAdministrator(input.administrator);
    const password = input.administrator?.password;
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    const result = await pool.query(
      `update registration_drafts
       set current_step = coalesce($2, current_step),
           company = company || $3::jsonb,
           contact = contact || $4::jsonb,
           documents = $5::jsonb,
           delivery_locations = coalesce($6::jsonb, delivery_locations),
           administrator = administrator || $7::jsonb,
           admin_password_hash = coalesce($8, admin_password_hash),
           updated_at = now()
       where id = $1
       returning *`,
      [
        current.id,
        input.currentStep,
        JSON.stringify(input.company ?? {}),
        JSON.stringify(input.contact ?? {}),
        JSON.stringify(mergedDocuments),
        input.deliveryLocations ? JSON.stringify(input.deliveryLocations) : null,
        JSON.stringify(administrator ?? {}),
        passwordHash,
      ],
    );

    return mapRegistration(result.rows[0]);
  }

  async submitDraft(id: string) {
    const draft = await this.getInternalDraft(id);

    if (draft.status !== 'DRAFT' && draft.status !== 'CHANGES_REQUESTED') {
      if (!draft.reference || !draft.submittedAt) {
        throw new AppError(
          'Registration has already moved out of draft but is missing submission details.',
          409,
          'REGISTRATION_SUBMISSION_STATE_INVALID',
        );
      }

      return draft;
    }

    const passwordResult = await pool.query(
      'select admin_password_hash from registration_drafts where id = $1',
      [id],
    );
    this.validateCompleteDraft(draft, Boolean(passwordResult.rows[0]?.admin_password_hash));
    const reference = draft.reference ?? (await this.createUniqueReference());

    const result = await pool.query(
      `update registration_drafts
       set status = 'PENDING_SALES_REVIEW',
           reference = $2,
           submitted_at = coalesce(submitted_at, now()),
           updated_at = now()
       where id = $1
         and status in ('DRAFT', 'CHANGES_REQUESTED')
       returning *`,
      [id, reference],
    );

    return result.rows[0] ? mapRegistration(result.rows[0]) : this.getDraft(id);
  }

  private async createUniqueReference() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = `APP-${new Date().getFullYear()}-${Math.floor(
        100000 + Math.random() * 900000,
      )}`;
      const existing = await pool.query('select 1 from registration_drafts where reference = $1', [
        reference,
      ]);
      if (existing.rowCount === 0) return reference;
    }

    throw new AppError(
      'Unable to generate application reference.',
      500,
      'REFERENCE_GENERATION_FAILED',
    );
  }

  private validateCompleteDraft(draft: RegistrationDraft, hasPasswordHash: boolean) {
    const errors: Record<string, string> = {};
    const company = draft.company;
    const contact = draft.contact;
    const administrator = draft.administrator;
    const documents = draft.documents as {
      cr?: Record<string, unknown>;
      vat?: Record<string, unknown>;
    };

    if (!isNonEmptyString(company.companyName)) errors.companyName = 'Company name is required.';
    if (!/^\d{10}$/.test(String(company.crNumber ?? ''))) {
      errors.crNumber = 'CR Number must contain exactly 10 digits.';
    }
    if (!/^\d{15}$/.test(String(company.vatNumber ?? ''))) {
      errors.vatNumber = 'VAT Number must contain exactly 15 digits.';
    }
    if (!/^\d{5}$/.test(String(company.postalCode ?? ''))) {
      errors.postalCode = 'Postal Code must contain exactly 5 digits.';
    }
    if (!isNonEmptyString(company.streetAddress))
      errors.streetAddress = 'Street address is required.';
    if (!isNonEmptyString(company.city)) errors.city = 'City is required.';
    if (!isNonEmptyString(company.region)) errors.region = 'Region is required.';
    if (!isNonEmptyString(company.country)) errors.country = 'Country is required.';

    if (!isNonEmptyString(contact.fullName))
      errors.contactFullName = 'Contact full name is required.';
    if (!isNonEmptyString(contact.jobTitle))
      errors.contactJobTitle = 'Contact job title is required.';
    if (!isNonEmptyString(contact.email) || !emailPattern.test(String(contact.email))) {
      errors.contactEmail = 'Contact email must be valid.';
    }
    if (!saudiMobilePattern.test(String(contact.phone ?? ''))) {
      errors.contactPhone = 'Contact phone must be a valid Saudi mobile number.';
    }

    if (!isDocumentMetadataComplete(documents.cr)) {
      errors.companyCrDocument = 'Company CR document file and future expiry date are required.';
    }
    if (!isDocumentMetadataComplete(documents.vat)) {
      errors.vatDocument = 'VAT Certificate file and future expiry date are required.';
    }

    if (!Array.isArray(draft.deliveryLocations) || draft.deliveryLocations.length === 0) {
      errors.deliveryLocations = 'At least one delivery location is required.';
    } else {
      draft.deliveryLocations.forEach((location, index) => {
        const item = location as Record<string, unknown>;
        if (!isNonEmptyString(item.name)) {
          errors[`deliveryLocations.${index}.name`] = 'Location name is required.';
        }
        if (!isNonEmptyString(item.streetAddress)) {
          errors[`deliveryLocations.${index}.streetAddress`] = 'Street address is required.';
        }
        if (!isNonEmptyString(item.city)) {
          errors[`deliveryLocations.${index}.city`] = 'City is required.';
        }
        if (!isNonEmptyString(item.region)) {
          errors[`deliveryLocations.${index}.region`] = 'Region is required.';
        }
        if (!isNonEmptyString(item.country)) {
          errors[`deliveryLocations.${index}.country`] = 'Country is required.';
        }
        if (!isNonEmptyString(item.contactPerson)) {
          errors[`deliveryLocations.${index}.contactPerson`] = 'Contact person is required.';
        }
        if (!saudiMobilePattern.test(String(item.contactPhone ?? ''))) {
          errors[`deliveryLocations.${index}.contactPhone`] =
            'Contact phone must be a valid Saudi mobile number.';
        }
        const hasLatitude = item.latitude !== undefined;
        const hasLongitude = item.longitude !== undefined;
        if (hasLatitude !== hasLongitude) {
          errors[`deliveryLocations.${index}.coordinates`] =
            'Both latitude and longitude are required when a map location is selected.';
        }
        if (!isValidOptionalLatitude(item.latitude)) {
          errors[`deliveryLocations.${index}.latitude`] = 'Latitude must be between -90 and 90.';
        }
        if (!isValidOptionalLongitude(item.longitude)) {
          errors[`deliveryLocations.${index}.longitude`] =
            'Longitude must be between -180 and 180.';
        }
        if (item.isPrimary !== undefined && typeof item.isPrimary !== 'boolean') {
          errors[`deliveryLocations.${index}.isPrimary`] =
            'Primary delivery location flag must be true or false.';
        }
      });
    }

    if (!isNonEmptyString(administrator.fullName)) {
      errors.adminFullName = 'Administrator full name is required.';
    }
    if (!isNonEmptyString(administrator.jobTitle)) {
      errors.adminJobTitle = 'Administrator job title is required.';
    }
    if (!isNonEmptyString(administrator.email) || !emailPattern.test(String(administrator.email))) {
      errors.adminEmail = 'Administrator email must be valid.';
    }
    if (!saudiMobilePattern.test(String(administrator.phone ?? ''))) {
      errors.adminPhone = 'Administrator phone must be a valid Saudi mobile number.';
    }
    if (!hasPasswordHash) errors.password = 'Administrator password is required.';

    if (Object.keys(errors).length > 0) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
    }
  }
}

export const registrationService = new RegistrationService();

function isDocumentMetadataComplete(document: Record<string, unknown> | undefined) {
  return Boolean(
    document &&
    isNonEmptyString(document.fileName) &&
    typeof document.fileSize === 'number' &&
    document.fileSize > 0 &&
    isNonEmptyString(document.fileType) &&
    isNonEmptyString(document.storageKey) &&
    isNonEmptyString(document.uploadedAt) &&
    isFutureDate(document.expiryDate),
  );
}

function mergeDocuments(
  currentDocuments: Record<string, unknown>,
  nextDocuments: UpdateRegistrationInput['documents'],
) {
  if (!nextDocuments) return currentDocuments;

  return {
    ...currentDocuments,
    ...(nextDocuments.cr
      ? {
          cr: {
            ...toRecord(currentDocuments.cr),
            ...nextDocuments.cr,
          },
        }
      : {}),
    ...(nextDocuments.vat
      ? {
          vat: {
            ...toRecord(currentDocuments.vat),
            ...nextDocuments.vat,
          },
        }
      : {}),
  };
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

function toRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
