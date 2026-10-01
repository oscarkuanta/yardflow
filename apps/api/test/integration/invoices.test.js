import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { NOTIFICATION_NEW, createEventBus } from '../../src/lib/event-bus.js';
import {
  USER_EMAILS,
  createCompany,
  createContainer,
  createInvoice,
  createUsersForAllRoles,
  loginAs,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const INVOICES_PATH = '/api/v1/invoices';
const NOW = new Date('2026-09-30T08:00:00Z');

function binaryParser(response, callback) {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('invoices (spec 6.10)', () => {
  const eventBus = createEventBus();
  const { app, prisma, close } = createTestContext({ clock: () => NOW, eventBus });
  let admin;
  let customer;
  let users;
  let ownInvoice;
  let otherInvoice;
  let ownContainer;
  let otherContainer;

  beforeEach(async () => {
    await resetDatabase(prisma);
    let company;
    ({ users, company } = await createUsersForAllRoles(prisma));
    const otherCompany = await createCompany(prisma, { code: 'OTH', name: 'Other Freight' });
    ownContainer = await createContainer(prisma, { companyId: company.id });
    otherContainer = await createContainer(prisma, { companyId: otherCompany.id });
    const period = { periodFrom: new Date('2026-09-20T08:00:00Z'), periodTo: NOW };
    ownInvoice = await createInvoice(prisma, {
      containerId: ownContainer.id,
      status: 'UNPAID',
      amountCents: 6000,
      ...period,
    });
    otherInvoice = await createInvoice(prisma, {
      containerId: otherContainer.id,
      status: 'PAID',
      ...period,
    });
    admin = await loginAs(app, USER_EMAILS.ADMIN);
    customer = await loginAs(app, USER_EMAILS.CUSTOMER);
  });

  afterAll(close);

  describe('GET /invoices', () => {
    test('shows admin every invoice with who marked it paid', async () => {
      const response = await admin.get(INVOICES_PATH);
      expect(response.body.total).toBe(2);
      expect(response.body.data[0]).toHaveProperty('paidMarkedBy');
      expect(response.body.data[0].pdfUrl).toMatch(/^\/api\/v1\/invoices\/\d+\/pdf$/);
    });

    test('shows a customer only its own invoices, even when it filters for another container', async () => {
      const own = await customer.get(INVOICES_PATH);
      expect(own.body.data.map((invoice) => invoice.id)).toEqual([ownInvoice.id]);
      expect(own.body.data[0]).not.toHaveProperty('paidMarkedBy');
      const foreign = await customer.get(
        `${INVOICES_PATH}?containerNumber=${otherContainer.number}`,
      );
      expect(foreign.body.total).toBe(0);
      const byCompany = await customer.get(`${INVOICES_PATH}?companyCode=OTH`);
      expect(byCompany.body.data.map((invoice) => invoice.id)).toEqual([ownInvoice.id]);
    });

    test('filters admin results by status, container and company', async () => {
      expect((await admin.get(`${INVOICES_PATH}?status=UNPAID`)).body.total).toBe(1);
      expect(
        (await admin.get(`${INVOICES_PATH}?containerNumber=${ownContainer.number}`)).body.total,
      ).toBe(1);
      expect((await admin.get(`${INVOICES_PATH}?companyCode=oth`)).body.data[0].id).toBe(
        otherInvoice.id,
      );
    });
  });

  describe('POST /invoices/:id/mark-paid', () => {
    test('marks an unpaid invoice paid, notifies the company and audits it', async () => {
      const events = recordEvents(eventBus, [NOTIFICATION_NEW]);
      const response = await admin.post(`${INVOICES_PATH}/${ownInvoice.id}/mark-paid`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'PAID',
        paidAt: NOW.toISOString(),
        paidMarkedBy: { id: users.ADMIN.id, name: 'Test admin' },
      });
      expect(events[0].payload).toMatchObject({ type: 'INVOICE_PAID' });
      expect(await prisma.auditLog.count({ where: { action: 'MARK_PAID' } })).toBe(1);
    });

    test('refuses an invoice that is not unpaid and answers 404 for an unknown one', async () => {
      const response = await admin.post(`${INVOICES_PATH}/${otherInvoice.id}/mark-paid`);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVOICE_NOT_UNPAID');
      expect((await admin.post(`${INVOICES_PATH}/999999/mark-paid`)).status).toBe(404);
    });
  });

  describe('GET /invoices/:id/pdf', () => {
    test('serves the PDF to admin and to the owner company, and 404 to other customers', async () => {
      const pdf = await admin
        .get(`${INVOICES_PATH}/${ownInvoice.id}/pdf`)
        .buffer(true)
        .parse(binaryParser);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toBe('application/pdf');
      expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect((await customer.get(`${INVOICES_PATH}/${ownInvoice.id}/pdf`)).status).toBe(200);
      expect((await customer.get(`${INVOICES_PATH}/${otherInvoice.id}/pdf`)).status).toBe(404);
    });
  });
});
