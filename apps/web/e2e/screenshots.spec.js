import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { DEMO, signIn, syncClockWithServer, verifyTruck } from './helpers.js';

const SCREENSHOT_DIR = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));

test.use({ colorScheme: 'dark' });

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

test('landing page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await syncClockWithServer(page);
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Latest gate events' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SCREENSHOT_DIR}landing.png` });
});

test('planner overview', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 960 });
  await signIn(page, 'planner');
  await expect(page.locator('[data-block="X"]')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SCREENSHOT_DIR}planner-overview.png` });
});

test('gate-in on a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await signIn(page, 'gate');
  await page.goto('/app/gate');
  await verifyTruck(page, DEMO.delivery);
  const truckPanel = page.getByRole('complementary', { name: 'Truck and container' });
  const containerNumber = (await truckPanel.locator('p.numeric').first().textContent()).replace(
    /\s/g,
    '',
  );
  await page.getByLabel('Container number on the box').fill(containerNumber);
  await page.getByRole('button', { name: 'Front', exact: true }).click();
  await page.getByRole('button', { name: 'Dent', exact: true }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SCREENSHOT_DIR}gate-in-tablet.png`, fullPage: true });
});

test('customer portal on a phone', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();
  await signIn(page, 'customer');
  await expect(page.getByRole('list', { name: 'Containers' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SCREENSHOT_DIR}customer-phone.png` });
  await context.close();
});
