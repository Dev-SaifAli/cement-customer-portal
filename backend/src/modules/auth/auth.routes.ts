import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authController } from './auth.controller.js';

const createAuthLimiter = (max: number) =>
  rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait and try again.',
      },
    },
  });

export const authRouter = Router();

authRouter.get(
  '/captcha',
  asyncHandler((request, response) => authController.createCaptchaChallenge(request, response)),
);

authRouter.post(
  '/login',
  createAuthLimiter(env.AUTH_LOGIN_RATE_LIMIT_MAX),
  asyncHandler((request, response) => authController.login(request, response)),
);

authRouter.post(
  '/forgot-password',
  createAuthLimiter(env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX),
  asyncHandler((request, response) => authController.forgotPassword(request, response)),
);
