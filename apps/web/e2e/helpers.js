import { expect } from '@playwright/test';

export const DEMO = {
  pickup: { plate: 'HH-YF 482', pin: '482913', driver: 'Jan Becker', container: 'HNFU2045711' },
  delivery: { plate: 'HH-YF 175', pin: '175824', driver: 'Mats Olsen' },
};

const ROLE_BUTTONS = {
  admin: /^Admin/,
  planner: /^Planner/,
  gate: /^Gate operator/,
  customer: /^Customer/,
};

export async function syncClockWithServer(page) {
  const response = await page.request.get('/api/v1/public/stats');
  const { data } = await response.json();
  await page.clock.setFixedTime(new Date(data.generatedAt));
}

export async function signIn(page, role) {
  await syncClockWithServer(page);
  await page.goto('/login');
  await page.getByRole('button', { name: ROLE_BUTTONS[role] }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(role === 'customer' ? /\/portal$/ : /\/app$/);
}

export async function newSignedInPage(browser, role, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await signIn(page, role);
  return page;
}

export async function verifyTruck(page, { plate, pin }) {
  await page.getByLabel('Truck plate').fill(plate);
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Verify truck' }).click();
  await expect(page.getByText(/Lane 1 camera/)).toBeVisible();
}

export async function apiJson(page, path) {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.ok()).toBe(true);
  return response.json();
}
