import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDatabase } from './database/pool.js';

const server = createApp().listen(env.PORT, () => logger.info({ port: env.PORT }, 'API started'));

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
