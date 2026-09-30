import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_ENV_FILE = fileURLToPath(new URL('../../../../.env', import.meta.url));

export function useTestDatabase() {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL_TEST is not set. Copy .env.example to .env first.');
  }
  if (!new URL(testDatabaseUrl).pathname.includes('test')) {
    throw new Error('DATABASE_URL_TEST must point to a database whose name contains "test".');
  }
  process.env.DATABASE_URL = testDatabaseUrl;
}
