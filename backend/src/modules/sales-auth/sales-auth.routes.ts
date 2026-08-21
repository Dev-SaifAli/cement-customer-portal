import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireSalesAuth } from './sales-auth.middleware.js';
import { salesAuthController } from './sales-auth.controller.js';

const salesLoginLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
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

export const salesAuthRouter = Router();

salesAuthRouter.post(
  '/login',
  salesLoginLimiter,
  asyncHandler((request, response) => salesAuthController.login(request, response)),
);

salesAuthRouter.get(
  '/me',
  requireSalesAuth,
  asyncHandler((request, response) => salesAuthController.me(request, response)),
);

salesAuthRouter.post(
  '/logout',
  requireSalesAuth,
  asyncHandler((request, response) => salesAuthController.logout(request, response)),
);
