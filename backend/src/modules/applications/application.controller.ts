import type { Request, Response } from 'express';
import { applicationService } from './application.service.js';
import {
  applicationReferenceSchema,
  applicationStatusLookupSchema,
} from './application.validation.js';

export class ApplicationController {
  async lookupStatus(request: Request, response: Response) {
    const payload = applicationStatusLookupSchema.parse(request.body);
    const application = await applicationService.getApplicationStatus(payload);

    response.status(200).json({
      success: true,
      application,
    });
  }

  async getStatus(request: Request, response: Response) {
    const reference = applicationReferenceSchema.parse(request.params.reference);
    const payload = applicationStatusLookupSchema.parse({
      reference,
      email: request.query.email,
    });
    const application = await applicationService.getApplicationStatus(payload);

    response.status(200).json({
      success: true,
      application,
    });
  }
}

export const applicationController = new ApplicationController();
