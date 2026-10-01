import { expect, test } from '@playwright/test';
import { DEMO, signIn, verifyTruck } from './helpers.js';

test('admin logs in and sees the yard dashboard', async ({ page }) => {
  await signIn(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Yard occupancy' })).toBeVisible();
  await expect(page.locator('[data-block="A"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gate feed' }).first()).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Staff' }).getByRole('link', { name: /Admin/ }),
  ).toBeVisible();
});

test('gate operator completes a gate-in with one damage and finds the box on the yard map', async ({
  page,
}) => {
  await signIn(page, 'gate');
  await page.getByRole('navigation', { name: 'Staff' }).getByRole('link', { name: /Gate/ }).click();
  await verifyTruck(page, DEMO.delivery);

  const truckPanel = page.getByRole('complementary', { name: 'Truck and container' });
  const containerNumber = (await truckPanel.locator('p.numeric').first().textContent()).replace(
    /\s/g,
    '',
  );
  await page.getByLabel('Container number on the box').fill(containerNumber);
  await expect(page.getByText('ISO 6346 check digit valid').first()).toBeVisible();

  await page.getByRole('button', { name: 'Left', exact: true }).click();
  await page.getByRole('button', { name: 'Dent', exact: true }).click();
  await expect(page.getByText('Reported: Left dent')).toBeVisible();

  const confirm = page.getByRole('button', { name: /^Confirm gate-in to .+ and print EIR$/ });
  await expect(confirm).toBeEnabled();
  const position = (await confirm.textContent()).match(/to (\S+) and/)[1];
  const eirTab = page.context().waitForEvent('page');
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Gate-in complete' })).toBeVisible();
  await (await eirTab).close();

  await page.getByRole('link', { name: 'Back to the yard' }).click();
  await page.getByRole('tab', { name: 'Table' }).click();
  const stackCode = position.split('-').slice(0, 3).join('-');
  await page.getByRole('button', { name: stackCode, exact: true }).click();
  const drawer = page.getByRole('dialog', { name: stackCode });
  await expect(drawer.getByText(containerNumber)).toBeVisible();
});

test.describe.serial('gate-out with a customs hold and relocations', () => {
  let admin;
  let gate;

  test.beforeAll(async ({ browser }) => {
    admin = await (await browser.newContext()).newPage();
    gate = await (await browser.newContext()).newPage();
    await signIn(admin, 'admin');
    await signIn(gate, 'gate');
  });

  test.afterAll(async () => {
    await admin.context().close();
    await gate.context().close();
  });

  test('a customs hold denies the gate-out until it is released', async () => {
    await admin.goto('/app/customs');
    await admin.getByRole('button', { name: 'Place hold' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Place a customs hold' });
    await dialog.getByLabel('Container number').fill(DEMO.pickup.container);
    await dialog.getByLabel('Reason').fill('E2E inspection');
    await dialog.getByRole('button', { name: 'Place hold' }).click();
    await expect(admin.getByText('Hold placed on HNFU 204571 1')).toBeVisible();

    await gate.goto('/app/gate');
    await gate.getByRole('tab', { name: 'Gate-out' }).click();
    await verifyTruck(gate, DEMO.pickup);
    await gate.getByLabel('Driver name as on the ID').fill(DEMO.pickup.driver);
    await gate.getByRole('button', { name: 'Run the 4 checks' }).click();
    await expect(gate.getByText('Active customs hold: E2E inspection')).toBeVisible();
    await expect(
      gate.getByRole('button', { name: 'Complete gate-out and print EIR' }),
    ).toBeDisabled();

    const holdRow = admin.getByRole('row', { name: /HNFU 204571 1/ });
    await holdRow.getByRole('button', { name: 'Release' }).click();
    await admin.getByRole('button', { name: 'Release hold' }).click();
    await expect(admin.getByText('Hold released on HNFU 204571 1')).toBeVisible();

    await gate.getByRole('button', { name: 'Run the checks again' }).click();
    const results = gate.getByRole('list', { name: 'Check results' });
    await expect(results.getByText('No active customs hold')).toBeVisible();
    await expect(results.getByText('Passed')).toHaveCount(4);
  });

  test('two blocking boxes become work orders and the gate-out completes after them', async ({
    browser,
  }) => {
    await expect(gate.getByText('Waiting for 2 relocations')).toBeVisible();
    const planner = await (await browser.newContext()).newPage();
    await signIn(planner, 'planner');
    await planner.goto('/app/work-orders');
    const doneButtons = planner.getByRole('button', { name: /^Mark relocation of .+ done$/ });
    await expect(doneButtons).toHaveCount(2);
    await expect(doneButtons.nth(0)).toBeEnabled();
    await expect(doneButtons.nth(1)).toBeDisabled();
    await doneButtons.nth(0).click();
    await expect(planner.getByText(/^Relocation done/)).toBeVisible();
    await expect(doneButtons).toHaveCount(1);
    await expect(doneButtons.nth(0)).toBeEnabled();
    await doneButtons.nth(0).click();
    await expect(planner.getByText('No work orders here')).toBeVisible();
    await planner.context().close();

    const complete = gate.getByRole('button', { name: 'Complete gate-out and print EIR' });
    await expect(complete).toBeEnabled({ timeout: 20_000 });
    const eirTab = gate.context().waitForEvent('page');
    await complete.click();
    await expect(gate.getByRole('heading', { name: 'Gate-out complete' })).toBeVisible();
    await (await eirTab).close();
  });
});
