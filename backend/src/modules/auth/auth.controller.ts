import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { forgotPasswordSchema, loginSchema } from './auth.validation.js';

export class AuthController {
  async createCaptchaChallenge(_request: Request, response: Response) {
    const result = await authService.createCaptchaChallenge();
    response.status(200).json(result);
  }

  async login(request: Request, response: Response) {
    const payload = loginSchema.parse(request.body);
    const result = await authService.login(payload);
    response.status(200).json(result);
  }

  async forgotPassword(request: Request, response: Response) {
    const payload = forgotPasswordSchema.parse(request.body);
    const result = await authService.forgotPassword(payload);
    response.status(200).json(result);
  }
}

export const authController = new AuthController();
