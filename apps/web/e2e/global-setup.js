import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { E2E_BASE_URL } from '../playwright.config.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const COMPOSE = 'docker compose -p yardflow-e2e -f docker-compose.yml -f docker-compose.e2e.yml';
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 2_000;

async function isHealthy() {
  try {
    const response = await fetch(`${E2E_BASE_URL}/api/v1/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isHealthy()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }
  throw new Error(`The E2E stack did not become healthy at ${E2E_BASE_URL}`);
}

export default async function globalSetup() {
  if (process.env.E2E_RESTART_API !== 'false') {
    execSync(`${COMPOSE} restart api`, { cwd: REPO_ROOT, stdio: 'inherit' });
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS * 2));
  }
  await waitForApi();
}
