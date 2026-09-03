import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { registerCustomerTicketEmailNotifications } from './modules/customer-tickets/customer-ticket-email-notifications.js';
import { registerCustomerTicketWhatsAppNotifications } from './modules/ticket-notifications/customer-ticket-whatsapp-notifications.js';
import { v1Router } from './routes/v1.js';

export const createApp = () => {
  registerCustomerTicketEmailNotifications();
  registerCustomerTicketWhatsAppNotifications();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || getAllowedCorsOrigins().has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin is not allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', v1Router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

const getAllowedCorsOrigins = () => {
  const origins = new Set<string>([env.APP_URL, ...(env.CORS_ALLOWED_ORIGINS ?? [])]);

  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return origins;
};
