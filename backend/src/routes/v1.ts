import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';

export const v1Router = Router();
v1Router.use('/auth', authRouter);
v1Router.use('/health', healthRouter);
