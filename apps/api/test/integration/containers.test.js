import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { formatContainerNumber, generateContainerNumber } from '@yardflow/shared';
import {
  USER_EMAILS,
  createCompany,
  createContainer,
  createHold,
  createSmallYard,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const CONTAINERS_PATH = '/api/v1/containers';
const NOW = new Date('2026-09-30T10:00:00Z');
const FOUR_DAYS_AGO = new Date('2026-09-26T12:00:00Z');

describe('containers', () => {
  const { app, prisma, close } = createTestContext({ clock: () => NOW });
  let planner;
  let customer;
  let users;
  let ownInYard;
  let ownDeparted;
  let otherInYard;

  beforeEach(async () => {
    await resetDatabase(prisma);
    let company;
    ({ users, company } = await createUsersForAllRoles(prisma));
    const otherCompany = await createCompany(prisma, { code: 'OTH', name: 'Other Freight' });
    const yard = await createSmallYard(prisma);
    ownInYard = await placeContainer(prisma, {
      block: yard.B,
      row: 2,
      bay: 3,
      tier: 1,
      companyId: company.id,
      gateInAt: FOUR_DAYS_AGO,
    });
    ownDeparted = await createContainer(prisma, {
      companyId: company.id,
      state: 'DEPARTED',
      departedAt: NOW,
    });
    otherInYard = await placeContainer(prisma, {
      block: yard.A,
      row: 1,
      bay: 1,
      tier: 1,
      companyId: otherCompany.id,
      size: 'FT20',
    });
    await createHold(prisma, { containerId: ownInYard.id, placedById: users.ADMIN.id });
    await prisma.movement.create({
      data: {
        containerId: ownInYard.id,
        type: 'GATE_IN',
        toPosition: 'B-02-03-1',
        userId: users.GATE_OPERATOR.id,
      },
    });
    await prisma.storageInvoice.create({
      data: {
        number: 'INV-2026-00001',
        containerId: ownInYard.id,
        periodFrom: FOUR_DAYS_AGO,
        periodTo: NOW,
        days: 4,
        freeDays: 5,
        chargeableDays: 0,
        dailyRateCents: 1500,
        amountCents: 0,
        status: 'PAID',
      },
    });
    planner = await loginAs(app, USER_EMAILS.PLANNER);
    customer = await loginAs(app, USER_EMAILS.CUSTOMER);
  });

  afterAll(close);

  describe('GET /containers', () => {
    test('shows staff every container with owner, position, hold flag and dwell days', async () => {
      const response = await planner.get(CONTAINERS_PATH);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      const summary = response.body.data.find((item) => item.number === ownInYard.number);
      expect(summary).toMatchObject({
        displayNumber: formatContainerNumber(ownInYard.number),
        state: 'IN_YARD',
        positionCode: 'B-02-03-1',
        hasHold: true,
        dwellDays: 4,
        owner: { code: 'TST', name: 'Test Freight' },
      });
      const departed = response.body.data.find((item) => item.number === ownDeparted.number);
      expect(departed).toMatchObject({ positionCode: null, dwellDays: null, hasHold: false });
    });

    test('shows a customer only the containers of its own company', async () => {
      const response = await customer.get(CONTAINERS_PATH);
      expect(response.body.data.map((item) => item.number).sort()).toEqual(
        [ownInYard.number, ownDeparted.number].sort(),
      );
      const withOtherOwner = await customer.get(`${CONTAINERS_PATH}?ownerCode=OTH`);
      expect(withOtherOwner.body.data.every((item) => item.owner.code === 'TST')).toBe(true);
    });

    test.each([
      ['state=IN_YARD', 2],
      ['hasHold=true', 1],
      ['hasHold=false', 2],
      ['ownerCode=oth', 1],
      ['blockCode=a', 1],
      ['size=FT20', 1],
    ])('filters staff results with %s', async (queryString, total) => {
      const response = await planner.get(`${CONTAINERS_PATH}?${queryString}`);
      expect(response.body.total).toBe(total);
    });

    test('searches by part of the number, ignoring case and spaces', async () => {
      const part = formatContainerNumber(ownInYard.number).slice(0, 8).toLowerCase();
      const response = await planner.get(`${CONTAINERS_PATH}?search=${encodeURIComponent(part)}`);
      expect(response.body.data.map((item) => item.number)).toContain(ownInYard.number);
    });
  });

  describe('GET /containers/:number', () => {
    test('shows staff the detail with holds, invoices, history and who did what', async () => {
      const response = await planner.get(`${CONTAINERS_PATH}/${ownInYard.number.toLowerCase()}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        number: ownInYard.number,
        holds: [{ isActive: true, placedBy: { id: users.ADMIN.id, name: 'Test admin' } }],
        invoices: [{ number: 'INV-2026-00001', amountCents: 0, status: 'PAID' }],
        history: [{ type: 'GATE_IN', toPosition: 'B-02-03-1', by: { name: 'Test gate_operator' } }],
        openWorkOrders: [],
      });
    });

    test('shows a customer its own container without staff details', async () => {
      const response = await customer.get(`${CONTAINERS_PATH}/${ownInYard.number}`);
      expect(response.status).toBe(200);
      expect(response.body.data.holds[0]).not.toHaveProperty('placedBy');
      expect(response.body.data.history[0]).not.toHaveProperty('by');
      expect(response.body.data).not.toHaveProperty('openWorkOrders');
    });

    test('answers 404, not 403, when a customer asks for another company container', async () => {
      const response = await customer.get(`${CONTAINERS_PATH}/${otherInYard.number}`);
      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Container not found',
      });
    });

    test('answers 404 for an unknown valid number', async () => {
      const number = generateContainerNumber('ZZZU', 5);
      expect((await planner.get(`${CONTAINERS_PATH}/${number}`)).status).toBe(404);
    });

    test.each([
      ['CSQU3054384', 'Invalid container number: check digit does not match'],
      ['CSQ3054383', 'Invalid container number format'],
    ])('rejects %s with 422 and the spec message', async (number, message) => {
      const response = await planner.get(`${CONTAINERS_PATH}/${number}`);
      expect(response.status).toBe(422);
      expect(response.body.error.details[0]).toEqual({ field: 'params.number', message });
    });
  });
});
