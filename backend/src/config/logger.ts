import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: 'logs/combined.log' },
        level: 'info',
      },
      {
        target: 'pino/file',
        options: { destination: 'logs/error.log' },
        level: 'error',
      },
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level: 'debug',
      },
    ],
  },
});
