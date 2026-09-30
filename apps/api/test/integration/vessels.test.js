import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import { generateContainerNumber } from '@yardflow/shared';
import {
  NOTIFICATION_NEW,
  VESSEL_CHANGED,
  YARD_CHANGED,
  createEventBus,
} from '../../src/lib/event-bus.js';
import {
  USER_EMAILS,
  createCompany,
  createContainer,
  createHold,
  createSmallYard,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  recordEvents,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const VISITS_PATH = '/api/v1/vessel-visits';
const NOW = new Date('2026-09-30T08:00:00Z');
const CSV_HEADER =
  'containerNumber,size,isHighCube,loadStatus,isDangerous,imoClass,grossWeightKg,ownerCode,direction';
const NEW_VISIT = {
  vesselName: 'Nordic Tern',
  imoNumber: '9814272',
  voyage: '042N',
  eta: '2026-09-30T04:00:00Z',
  etd: '2026-09-30T19:00:00Z',
};

function numberOf(serial) {
  return generateContainerNumber('VSLU', serial);
}

function itemFor(containerNumber, overrides = {}) {
  return {
    containerNumber,
    size: 'FT40',
    loadStatus: 'FULL',
    grossWeightKg: 24000,
    ownerCode: 'TST',
    direction: 'DISCHARGE',
    ...overrides,
  };
}

describe('vessel visits', () => {
  const eventBus = createEventBus();
  const { app, prisma, close } = createTestContext({ clock: () => NOW, eventBus });
  let planner;
  let users;
  let company;
  let yard;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ users, company } = await createUsersForAllRoles(prisma));
    yard = await createSmallYard(prisma);
    planner = await loginAs(app, USER_EMAILS.PLANNER);
  });

  afterAll(close);

  async function createVisit(overrides = {}) {
    const response = await planner.post(VISITS_PATH).send({ ...NEW_VISIT, ...overrides });
    return response.body.data;
  }

  async function arrivedVisit() {
    const visit = await createVisit();
    await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ status: 'ARRIVED' });
    return visit;
  }

  async function addItem(visit, item) {
    const response = await planner.post(`${VISITS_PATH}/${visit.id}/items`).send(item);
    return response.body.data;
  }

  describe('create, list and detail', () => {
    test('creates a PLANNED visit and audits it', async () => {
      const response = await planner.post(VISITS_PATH).send(NEW_VISIT);
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        vesselName: 'Nordic Tern',
        status: 'PLANNED',
        ata: null,
        discharge: { total: 0, done: 0 },
        load: { total: 0, done: 0 },
        progressPercent: 0,
      });
      expect(
        await prisma.auditLog.count({ where: { entity: 'VesselVisit', action: 'CREATE' } }),
      ).toBe(1);
    });

    test.each([
      [{ imoNumber: '981427' }, 'body.imoNumber'],
      [{ etd: '2026-09-30T03:00:00Z' }, 'body.etd'],
      [{ eta: '30.09.2026 06:00' }, 'body.eta'],
      [{ voyage: '' }, 'body.voyage'],
    ])('rejects %j with 422', async (changes, field) => {
      const response = await planner.post(VISITS_PATH).send({ ...NEW_VISIT, ...changes });
      expect(response.status).toBe(422);
      expect(response.body.error.details[0].field).toBe(field);
    });

    test('lists visits with their progress and finds them by name or voyage', async () => {
      const visit = await createVisit();
      await createVisit({ vesselName: 'Elbe Trader', voyage: '117S', eta: '2026-09-30T16:00:00Z' });
      await addItem(visit, itemFor(numberOf(1)));
      const response = await planner.get(`${VISITS_PATH}?search=117S`);
      expect(response.body.data.map((item) => item.vesselName)).toEqual(['Elbe Trader']);
      const all = await planner.get(VISITS_PATH);
      expect(all.body.data[0]).toMatchObject({
        vesselName: 'Nordic Tern',
        discharge: { total: 1 },
      });
    });

    test('shows the detail with every item, its owner and container state', async () => {
      const visit = await createVisit();
      await addItem(visit, itemFor(numberOf(1)));
      const response = await planner.get(`${VISITS_PATH}/${visit.id}`);
      expect(response.body.data.items).toEqual([
        expect.objectContaining({
          containerNumber: numberOf(1),
          direction: 'DISCHARGE',
          status: 'PENDING',
          owner: { id: company.id, code: 'TST', name: 'Test Freight' },
          containerState: 'EXPECTED',
          positionCode: null,
          hasHold: false,
        }),
      ]);
      expect((await planner.get(`${VISITS_PATH}/999999`)).status).toBe(404);
    });
  });

  describe('status flow (spec 6.12)', () => {
    test('sets ata when the vessel arrives', async () => {
      const visit = await createVisit();
      const response = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ status: 'ARRIVED' });
      expect(response.body.data).toMatchObject({ status: 'ARRIVED', ata: NOW.toISOString() });
    });

    test('refuses to skip from PLANNED to DEPARTED and refuses WORKING by hand', async () => {
      const visit = await createVisit();
      const skip = await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ status: 'DEPARTED' });
      expect(skip.status).toBe(409);
      expect(skip.body.error.code).toBe('INVALID_STATUS_CHANGE');
      const working = await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ status: 'WORKING' });
      expect(working.status).toBe(422);
    });

    test('refuses to depart with pending load items', async () => {
      const visit = await arrivedVisit();
      await addItem(visit, itemFor(numberOf(2), { direction: 'LOAD' }));
      const response = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ status: 'DEPARTED' });
      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({
        code: 'LOAD_ITEMS_PENDING',
        message: '1 load item is still pending. Confirm "Depart with open items" to depart anyway',
      });
    });

    test('departs with open items when confirmed, sets atd and audits it', async () => {
      const visit = await arrivedVisit();
      await addItem(visit, itemFor(numberOf(2), { direction: 'LOAD' }));
      const response = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ status: 'DEPARTED', departWithOpenItems: true });
      expect(response.body.data).toMatchObject({ status: 'DEPARTED', atd: NOW.toISOString() });
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'DEPART_WITH_OPEN_ITEMS' },
      });
      expect(audit.after).toEqual({ pendingLoadCount: 1 });
    });

    test('departs without confirmation when nothing is pending', async () => {
      const visit = await arrivedVisit();
      const response = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ status: 'DEPARTED' });
      expect(response.status).toBe(200);
      expect(await prisma.auditLog.count({ where: { action: 'DEPART_WITH_OPEN_ITEMS' } })).toBe(0);
    });

    test('refuses any change after departure', async () => {
      const visit = await arrivedVisit();
      await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ status: 'DEPARTED' });
      const response = await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ voyage: '043N' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('VISIT_DEPARTED');
    });

    test('updates the schedule and refuses an ETD before the ETA', async () => {
      const visit = await createVisit();
      const moved = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ etd: '2026-09-30T21:00:00Z' });
      expect(moved.body.data.etd).toBe('2026-09-30T21:00:00.000Z');
      const wrong = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ etd: '2026-09-30T02:00:00Z' });
      expect(wrong.status).toBe(422);
    });

    test('only accepts departWithOpenItems together with status DEPARTED', async () => {
      const visit = await arrivedVisit();
      const response = await planner
        .patch(`${VISITS_PATH}/${visit.id}`)
        .send({ departWithOpenItems: true });
      expect(response.status).toBe(422);
    });
  });

  describe('POST /vessel-visits/:id/items', () => {
    test('adds a discharge item and creates the container as EXPECTED', async () => {
      const visit = await createVisit();
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items`)
        .send(itemFor(numberOf(1).toLowerCase(), { ownerCode: 'tst', isHighCube: true }));
      expect(response.status).toBe(201);
      const container = await prisma.container.findUniqueOrThrow({
        where: { number: numberOf(1) },
      });
      expect(container).toMatchObject({
        state: 'EXPECTED',
        size: 'FT40',
        isHighCube: true,
        ownerCompanyId: company.id,
      });
    });

    test('brings a departed container back as EXPECTED with the new data', async () => {
      const departed = await createContainer(prisma, {
        companyId: company.id,
        state: 'DEPARTED',
        departedAt: new Date('2026-09-01T00:00:00Z'),
      });
      const visit = await createVisit();
      await addItem(visit, itemFor(departed.number, { size: 'FT45' }));
      const container = await prisma.container.findUniqueOrThrow({ where: { id: departed.id } });
      expect(container).toMatchObject({ state: 'EXPECTED', size: 'FT45', departedAt: null });
    });

    test('links a load item to the container in the yard', async () => {
      const inYard = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      const visit = await createVisit();
      const item = await addItem(visit, itemFor(inYard.number, { direction: 'LOAD' }));
      expect(item).toMatchObject({ containerState: 'IN_YARD', positionCode: 'B-01-01-1' });
    });

    test.each([
      ['an unknown owner', { ownerCode: 'ZZZ' }, 'body.ownerCode', 'Company ZZZ does not exist'],
      [
        'a DG item without IMO class',
        { isDangerous: true },
        'body.imoClass',
        'Dangerous goods need an IMO class',
      ],
      [
        'a bad check digit',
        { containerNumber: 'CSQU3054384' },
        'body.containerNumber',
        'Invalid container number: check digit does not match',
      ],
    ])('rejects %s with 422', async (_label, changes, field, message) => {
      const visit = await createVisit();
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items`)
        .send(itemFor(numberOf(1), changes));
      expect(response.status).toBe(422);
      expect(response.body.error.details).toContainEqual({ field, message });
    });

    test('rejects an inactive owner, a duplicate item and a discharge of a container in the yard', async () => {
      await createCompany(prisma, { code: 'OLD', name: 'Old Freight', isActive: false });
      const inYard = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      const visit = await createVisit();
      await addItem(visit, itemFor(numberOf(1)));
      const cases = [
        [itemFor(numberOf(2), { ownerCode: 'OLD' }), 'Company OLD is inactive'],
        [itemFor(numberOf(1)), 'Container is already on the discharge list of this visit'],
        [itemFor(inYard.number), 'Container is already in the yard'],
      ];
      for (const [body, message] of cases) {
        const response = await planner.post(`${VISITS_PATH}/${visit.id}/items`).send(body);
        expect(response.status).toBe(422);
        expect(response.body.error.details.map((detail) => detail.message)).toContain(message);
      }
    });

    test('refuses new items on a departed visit', async () => {
      const visit = await arrivedVisit();
      await planner.patch(`${VISITS_PATH}/${visit.id}`).send({ status: 'DEPARTED' });
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items`)
        .send(itemFor(numberOf(1)));
      expect(response.status).toBe(409);
    });
  });

  describe('POST /vessel-visits/:id/items/import', () => {
    function postCsv(visit, csv) {
      return planner
        .post(`${VISITS_PATH}/${visit.id}/items/import`)
        .set('Content-Type', 'text/csv')
        .send(csv);
    }

    test('imports every row of a valid file', async () => {
      const inYard = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 1,
        tier: 1,
        companyId: company.id,
      });
      const visit = await createVisit();
      const csv = [
        CSV_HEADER,
        `${numberOf(1)},FT40,yes,FULL,no,,24000,TST,DISCHARGE`,
        `${numberOf(2)},FT20,false,FULL,true,3,18000,tst,discharge`,
        `${inYard.number},FT40,false,FULL,false,,,TST,LOAD`,
      ].join('\n');
      const response = await postCsv(visit, csv);
      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ imported: 3, discharge: 2, load: 1 });
      expect(await prisma.container.count({ where: { state: 'EXPECTED' } })).toBe(2);
      expect(await prisma.auditLog.count({ where: { action: 'IMPORT_ITEMS' } })).toBe(1);
    });

    test('reports invalid rows per line and imports nothing', async () => {
      const visit = await createVisit();
      const csv = [
        CSV_HEADER,
        `${numberOf(1)},FT40,false,FULL,false,,24000,TST,DISCHARGE`,
        'CSQU3054384,FT40,false,FULL,false,,24000,TST,DISCHARGE',
        `${numberOf(3)},FT40,false,FULL,false,,24000,TST,SIDEWAYS`,
        `${numberOf(1)},FT40,false,FULL,false,,24000,TST,DISCHARGE`,
      ].join('\n');
      const response = await postCsv(visit, csv);
      expect(response.status).toBe(422);
      expect(response.body.error.message).toBe('3 lines have problems, nothing was imported');
      expect(response.body.error.details).toEqual([
        {
          line: 3,
          field: 'containerNumber',
          message: 'Invalid container number: check digit does not match',
        },
        { line: 4, field: 'direction', message: 'Direction must be DISCHARGE or LOAD' },
        { line: 5, field: 'containerNumber', message: 'Same container and direction as line 2' },
      ]);
      expect(await prisma.vesselVisitItem.count()).toBe(0);
    });

    test('reports database problems per line and imports nothing', async () => {
      const visit = await createVisit();
      const csv = [
        CSV_HEADER,
        `${numberOf(1)},FT40,false,FULL,false,,24000,TST,DISCHARGE`,
        `${numberOf(2)},FT40,false,FULL,false,,24000,QQQ,DISCHARGE`,
      ].join('\n');
      const response = await postCsv(visit, csv);
      expect(response.status).toBe(422);
      expect(response.body.error.details).toEqual([
        { line: 3, field: 'ownerCode', message: 'Company QQQ does not exist' },
      ]);
      expect(await prisma.vesselVisitItem.count()).toBe(0);
      expect(await prisma.container.count({ where: { state: 'EXPECTED' } })).toBe(0);
    });

    test('reports a missing column on line 1', async () => {
      const visit = await createVisit();
      const response = await postCsv(visit, 'containerNumber,size\nCSQU3054383,FT40');
      expect(response.status).toBe(422);
      expect(response.body.error.details[0]).toMatchObject({ line: 1, field: 'isHighCube' });
    });

    test('asks for a CSV body when the request is JSON or empty', async () => {
      const visit = await createVisit();
      const json = await planner.post(`${VISITS_PATH}/${visit.id}/items/import`).send({ rows: [] });
      expect(json.status).toBe(422);
      expect(json.body.error.details[0].message).toBe(
        'Send the list as a CSV text body with Content-Type text/csv',
      );
      expect((await postCsv(visit, '')).status).toBe(422);
    });
  });

  describe('POST /vessel-visits/:id/items/:itemId/discharge (spec 6.12)', () => {
    test('puts the container into the chosen slot and records everything', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED, VESSEL_CHANGED, NOTIFICATION_NEW]);
      const visit = await arrivedVisit();
      await addItem(visit, itemFor(numberOf(2), { direction: 'LOAD' }));
      const item = await addItem(visit, itemFor(numberOf(1)));
      events.length = 0;
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items/${item.id}/discharge`)
        .send({ to: 'B-02-03' });
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        itemId: item.id,
        containerNumber: numberOf(1),
        positionCode: 'B-02-03-1',
        visit: { visitId: visit.id, status: 'WORKING', doneCount: 1, totalCount: 2 },
      });
      const container = await prisma.container.findUniqueOrThrow({
        where: { number: numberOf(1) },
        include: { position: true, movements: true },
      });
      expect(container).toMatchObject({ state: 'IN_YARD', gateInAt: NOW });
      expect(container.position).toMatchObject({ blockId: yard.B.id, row: 2, bay: 3, tier: 1 });
      expect(container.movements).toEqual([
        expect.objectContaining({ type: 'DISCHARGE', toPosition: 'B-02-03-1', fromPosition: null }),
      ]);
      const savedItem = await prisma.vesselVisitItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(savedItem).toMatchObject({ status: 'DONE', doneAt: NOW, containerId: container.id });
      const notification = await prisma.notification.findFirstOrThrow();
      expect(notification).toMatchObject({
        companyId: company.id,
        type: 'CONTAINER_IN_YARD',
        containerNumber: numberOf(1),
      });
      expect(notification.message).toMatch(/is in the yard at B-02-03-1\.$/);
      expect(await prisma.auditLog.count({ where: { action: 'DISCHARGE' } })).toBe(1);
      expect(events.map((event) => event.eventName)).toEqual([
        YARD_CHANGED,
        VESSEL_CHANGED,
        NOTIFICATION_NEW,
      ]);
      expect(events[0].payload.changes).toEqual([
        { positionCode: 'B-02-03-1', containerNumber: numberOf(1), action: 'PLACED' },
      ]);
    });

    test('changes nothing when the chosen slot breaks a stacking rule', async () => {
      const visit = await arrivedVisit();
      const item = await addItem(visit, itemFor(numberOf(1)));
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items/${item.id}/discharge`)
        .send({ to: 'A-01-01' });
      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe(
        'A 40 ft container needs a LARGE block, block A is SMALL',
      );
      expect(
        await prisma.container.findUniqueOrThrow({ where: { number: numberOf(1) } }),
      ).toMatchObject({
        state: 'EXPECTED',
      });
      expect(await prisma.notification.count()).toBe(0);
      const visitAfter = await prisma.vesselVisit.findUniqueOrThrow({ where: { id: visit.id } });
      expect(visitAfter.status).toBe('ARRIVED');
    });

    test('refuses cargo work before the vessel has arrived', async () => {
      const visit = await createVisit();
      const item = await addItem(visit, itemFor(numberOf(1)));
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items/${item.id}/discharge`)
        .send({ to: 'B-02-03' });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('VISIT_NOT_AT_BERTH');
    });

    test('refuses a second discharge, a load item and an unknown item', async () => {
      const visit = await arrivedVisit();
      const item = await addItem(visit, itemFor(numberOf(1)));
      const loadItem = await addItem(visit, itemFor(numberOf(2), { direction: 'LOAD' }));
      const path = (itemId) => `${VISITS_PATH}/${visit.id}/items/${itemId}/discharge`;
      await planner.post(path(item.id)).send({ to: 'B-02-03' });
      const again = await planner.post(path(item.id)).send({ to: 'B-02-02' });
      expect(again.body.error.code).toBe('ITEM_ALREADY_DONE');
      const wrongList = await planner.post(path(loadItem.id)).send({ to: 'B-02-02' });
      expect(wrongList.body.error).toMatchObject({
        code: 'WRONG_DIRECTION',
        message: 'This item is on the load list',
      });
      expect((await planner.post(path(999999)).send({ to: 'B-02-02' })).status).toBe(404);
    });

    test('refuses a container that reached the yard some other way', async () => {
      const visit = await arrivedVisit();
      const item = await addItem(visit, itemFor(numberOf(1)));
      const container = await prisma.container.findUniqueOrThrow({
        where: { number: numberOf(1) },
      });
      await prisma.container.update({ where: { id: container.id }, data: { state: 'IN_YARD' } });
      const response = await planner
        .post(`${VISITS_PATH}/${visit.id}/items/${item.id}/discharge`)
        .send({ to: 'B-02-03' });
      expect(response.body.error.code).toBe('CONTAINER_ALREADY_IN_YARD');
    });
  });

  describe('POST /vessel-visits/:id/items/:itemId/load (spec 6.12)', () => {
    async function loadItemFor(container) {
      const visit = await arrivedVisit();
      const item = await addItem(visit, itemFor(container.number, { direction: 'LOAD' }));
      return { visit, item, path: `${VISITS_PATH}/${visit.id}/items/${item.id}/load` };
    }

    test('loads a top container: position gone, DEPARTED, movement LOAD, item DONE', async () => {
      const events = recordEvents(eventBus, [YARD_CHANGED, VESSEL_CHANGED]);
      const container = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 2,
        tier: 1,
        companyId: company.id,
      });
      const { visit, item, path } = await loadItemFor(container);
      events.length = 0;
      const response = await planner.post(path);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        itemId: item.id,
        containerNumber: container.number,
        fromPosition: 'B-01-02-1',
        visit: { visitId: visit.id, status: 'WORKING', doneCount: 1, totalCount: 1 },
      });
      const saved = await prisma.container.findUniqueOrThrow({
        where: { id: container.id },
        include: { position: true, movements: true },
      });
      expect(saved).toMatchObject({ state: 'DEPARTED', departedAt: NOW, position: null });
      expect(saved.movements).toEqual([
        expect.objectContaining({ type: 'LOAD', fromPosition: 'B-01-02-1', toPosition: null }),
      ]);
      expect(await prisma.auditLog.count({ where: { action: 'LOAD' } })).toBe(1);
      expect(events[0].payload.changes).toEqual([
        { positionCode: 'B-01-02-1', containerNumber: container.number, action: 'REMOVED' },
      ]);
    });

    test('refuses a container with an active customs hold', async () => {
      const container = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 2,
        tier: 1,
        companyId: company.id,
      });
      await createHold(prisma, { containerId: container.id, placedById: users.ADMIN.id });
      const { path } = await loadItemFor(container);
      const response = await planner.post(path);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CUSTOMS_HOLD_ACTIVE');
    });

    test('loads a container whose hold was released', async () => {
      const container = await placeContainer(prisma, {
        block: yard.B,
        row: 1,
        bay: 2,
        tier: 1,
        companyId: company.id,
      });
      await createHold(prisma, {
        containerId: container.id,
        placedById: users.ADMIN.id,
        releasedAt: NOW,
      });
      const { path } = await loadItemFor(container);
      expect((await planner.post(path)).status).toBe(200);
    });

    test('refuses a container that is not in the yard', async () => {
      const expected = await createContainer(prisma, { companyId: company.id, state: 'EXPECTED' });
      const { path } = await loadItemFor(expected);
      const response = await planner.post(path);
      expect(response.body.error.code).toBe('CONTAINER_NOT_IN_YARD');
    });

    test('creates relocation work orders for a blocked container, then loads once they are done', async () => {
      const stack = [];
      for (const tier of [1, 2, 3]) {
        stack.push(
          await placeContainer(prisma, {
            block: yard.B,
            row: 1,
            bay: 1,
            tier,
            companyId: company.id,
          }),
        );
      }
      const { path } = await loadItemFor(stack[0]);
      const blocked = await planner.post(path);
      expect(blocked.status).toBe(409);
      expect(blocked.body.error).toMatchObject({
        code: 'RELOCATION_PENDING',
        message: 'Waiting for 2 relocations',
      });
      expect(blocked.body.error.details.map((order) => order.containerNumber)).toEqual([
        stack[2].number,
        stack[1].number,
      ]);
      const again = await planner.post(path);
      expect(again.body.error.details.map((order) => order.id)).toEqual(
        blocked.body.error.details.map((order) => order.id),
      );
      expect(await prisma.workOrder.count({ where: { targetContainerId: stack[0].id } })).toBe(2);
      for (const order of blocked.body.error.details) {
        expect((await planner.post(`/api/v1/work-orders/${order.id}/complete`)).status).toBe(200);
      }
      const loaded = await planner.post(path);
      expect(loaded.status).toBe(200);
      expect(loaded.body.data.fromPosition).toBe('B-01-01-1');
    });
  });
});
