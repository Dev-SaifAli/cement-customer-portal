import { Router } from 'express';
import { applicationRouter } from '../modules/applications/application.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { registrationRouter } from '../modules/registrations/registration.routes.js';

export const v1Router = Router();
v1Router.use('/applications', applicationRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/health', healthRouter);
v1Router.use('/registrations', registrationRouter);
