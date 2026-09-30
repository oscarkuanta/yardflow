import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { useTestDatabase } from './test-database.js';

const API_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default function globalSetup() {
  useTestDatabase();
  execSync('npx prisma migrate deploy', { cwd: API_ROOT, stdio: 'pipe', env: process.env });
}
