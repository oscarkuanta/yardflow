import { expect, test } from '@playwright/test';
import { DEMO, apiJson, signIn } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('customer books a pickup slot and receives a PIN', async ({ page }) => {
  await signIn(page, 'customer');
  const inYard = await apiJson(page, '/containers?state=IN_YARD&hasHold=false&pageSize=100');
  const booked = await apiJson(page, '/pre-advices?status=ACTIVE&pageSize=100');
  const bookedNumbers = new Set(booked.data.map((preAdvice) => preAdvice.containerNumber));
  const free = inYard.data.find(
    (container) =>
      !bookedNumbers.has(container.number) && container.number !== DEMO.pickup.container,
  );

  await page.getByRole('button', { name: 'Book a pickup slot' }).click();
  const sheet = page.getByRole('dialog', { name: 'Book a pickup slot' });
  await sheet.getByLabel('Container to pick up').fill(free.number);
  const openSlot = sheet
    .getByRole('radiogroup', { name: 'Time slot' })
    .getByRole('radio', { disabled: false });
  await openSlot.first().click();
  await sheet.getByLabel('Truck plate').fill('HH-E2 390');
  await sheet.getByLabel('Driver name').fill('Erik Test');
  await sheet.getByRole('button', { name: /^Confirm/ }).click();

  const reveal = page.getByRole('dialog', { name: 'Slot booked' });
  await expect(reveal.getByText(/^\d{6}$/)).toBeVisible();
  await expect(reveal.getByText(/shown only once/)).toBeVisible();
  await reveal.getByRole('button', { name: 'Done' }).click();

  await page
    .getByRole('navigation', { name: 'Portal' })
    .getByRole('link', { name: 'Slots' })
    .click();
  await expect(page.getByText(free.displayNumber)).toBeVisible();
});

test("customer cannot open another company's container", async ({ browser, page }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signIn(admin, 'admin');
  const others = await apiJson(admin, '/containers?ownerCode=NRT&state=IN_YARD&pageSize=1');
  const foreignNumber = others.data[0].number;
  await adminContext.close();

  await signIn(page, 'customer');
  const response = await page.request.get(`/api/v1/containers/${foreignNumber}`);
  expect(response.status()).toBe(404);
  await page.goto(`/portal/containers/${foreignNumber}`);
  await expect(page.getByRole('heading', { name: 'Container not found' })).toBeVisible();
});
