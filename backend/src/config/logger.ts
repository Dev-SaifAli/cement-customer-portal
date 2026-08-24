import fs from 'node:fs';
import path from 'node:path';

import pino, { type TransportTargetOptions } from 'pino';

import { env } from './env.js';

const logsDir = path.resolve(process.cwd(), 'logs');

fs.mkdirSync(logsDir, { recursive: true });

const targets: TransportTargetOptions[] = [
  {
    target: 'pino/file',
    options: {
      destination: path.join(logsDir, 'combined.log'),
    },
    level: 'info',
  },
  {
    target: 'pino/file',
    options: {
      destination: path.join(logsDir, 'error.log'),
    },
    level: 'error',
  },
];

if (env.NODE_ENV !== 'production') {
  targets.push({
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
    level: 'debug',
  });
}

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    targets,
  },
});
