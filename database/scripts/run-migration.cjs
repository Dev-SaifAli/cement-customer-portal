const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '../..');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (!process.env.DATABASE_URL) {
  console.error(
    [
      'DATABASE_URL is not set.',
      '',
      'Create a root .env file from .env.example and update DATABASE_URL with your PostgreSQL password/database.',
      '',
      'Example:',
      'DATABASE_URL=postgresql://postgres:your-password@localhost:5432/cement_portal',
    ].join('\n'),
  );
  process.exit(1);
}

const nodePgMigrateBin = require.resolve('node-pg-migrate/bin/node-pg-migrate');
const result = spawnSync(process.execPath, [nodePgMigrateBin, ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
