import type { Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { registrationService } from './registration.service.js';
import { createRegistrationSchema, updateRegistrationSchema } from './registration.validation.js';

export class RegistrationController {
  async listCities(_request: Request, response: Response) {
    response
      .status(200)
      .json({ success: true, data: { cities: await registrationService.listCities() } });
  }

  async create(request: Request, response: Response) {
    const payload = createRegistrationSchema.parse(request.body ?? {});
    const registration = await registrationService.createDraft(payload);
    response.status(201).json({ success: true, registration });
  }

  async get(request: Request, response: Response) {
    const registration = await registrationService.getDraft(getRegistrationId(request));
    response.status(200).json({ success: true, registration });
  }

  async update(request: Request, response: Response) {
    const payload = updateRegistrationSchema.parse(request.body ?? {});
    const registration = await registrationService.updateDraft(getRegistrationId(request), payload);
    response.status(200).json({ success: true, registration });
  }

  async submit(request: Request, response: Response) {
    const registration = await registrationService.submitDraft(getRegistrationId(request));
    response.status(200).json({ success: true, registration });
  }
}

export const registrationController = new RegistrationController();

function getRegistrationId(request: Request) {
  const { id } = request.params;
  if (!id || Array.isArray(id)) {
    throw new AppError('Registration id is required.', 400, 'REGISTRATION_ID_REQUIRED');
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError('Registration id is invalid.', 400, 'REGISTRATION_ID_INVALID');
  }

  return id;
}
