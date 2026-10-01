import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  USER_EMAILS,
  createCompany,
  createUsersForAllRoles,
  loginAs,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const NOTIFICATIONS_PATH = '/api/v1/notifications';
const NOW = new Date('2026-09-30T08:00:00Z');

describe('notifications (spec 6.13)', () => {
  const { app, prisma, close } = createTestContext({ clock: () => NOW });
  let customer;
  let company;
  let otherCompany;

  async function notify(companyId, overrides = {}) {
    return prisma.notification.create({
      data: {
        companyId,
        type: 'CONTAINER_IN_YARD',
        message: 'TSTU 000001 6 is in the yard at B-01-01-1.',
        containerNumber: 'TSTU0000016',
        ...overrides,
      },
    });
  }

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ company } = await createUsersForAllRoles(prisma));
    otherCompany = await createCompany(prisma, { code: 'OTH', name: 'Other Freight' });
    customer = await loginAs(app, USER_EMAILS.CUSTOMER);
  });

  afterAll(close);

  test('lists only the own company notifications, newest first, with the unread count', async () => {
    await notify(company.id, { createdAt: new Date('2026-09-29T08:00:00Z') });
    await notify(company.id, { type: 'INVOICE_PAID', readAt: NOW });
    await notify(otherCompany.id);
    const response = await customer.get(NOTIFICATIONS_PATH);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 2, unreadCount: 1 });
    expect(response.body.data.map((item) => [item.type, item.isRead])).toEqual([
      ['INVOICE_PAID', true],
      ['CONTAINER_IN_YARD', false],
    ]);
  });

  test('filters unread notifications and by type', async () => {
    await notify(company.id);
    await notify(company.id, { type: 'INVOICE_PAID', readAt: NOW });
    expect((await customer.get(`${NOTIFICATIONS_PATH}?unread=true`)).body.total).toBe(1);
    expect((await customer.get(`${NOTIFICATIONS_PATH}?unread=false`)).body.total).toBe(1);
    expect((await customer.get(`${NOTIFICATIONS_PATH}?type=INVOICE_PAID`)).body.total).toBe(1);
  });

  test('marks one notification as read and keeps the first read time', async () => {
    const notification = await notify(company.id);
    const response = await customer.post(`${NOTIFICATIONS_PATH}/${notification.id}/read`);
    expect(response.body.data).toMatchObject({ isRead: true, readAt: NOW.toISOString() });
    const again = await customer.post(`${NOTIFICATIONS_PATH}/${notification.id}/read`);
    expect(again.body.data.readAt).toBe(NOW.toISOString());
  });

  test('answers 404 for another company notification', async () => {
    const foreign = await notify(otherCompany.id);
    expect((await customer.post(`${NOTIFICATIONS_PATH}/${foreign.id}/read`)).status).toBe(404);
  });

  test('marks all own notifications as read', async () => {
    await notify(company.id);
    await notify(company.id);
    await notify(otherCompany.id);
    const response = await customer.post(`${NOTIFICATIONS_PATH}/read-all`);
    expect(response.body.data).toEqual({ markedRead: 2 });
    expect(await prisma.notification.count({ where: { readAt: null } })).toBe(1);
  });
});
