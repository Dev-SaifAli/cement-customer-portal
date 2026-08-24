import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { customerAuthController } from './customer-auth.controller.js';
import { requireCustomerAuth } from './customer-auth.middleware.js';

const customerLoginLimiter = rateLimit({
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

export const customerAuthRouter = Router();

customerAuthRouter.post(
  '/login',
  customerLoginLimiter,
  asyncHandler((request, response) => customerAuthController.login(request, response)),
);

customerAuthRouter.get(
  '/me',
  requireCustomerAuth,
  asyncHandler((request, response) => customerAuthController.me(request, response)),
);

customerAuthRouter.post(
  '/logout',
  requireCustomerAuth,
  asyncHandler((request, response) => customerAuthController.logout(request, response)),
);
