import { afterAll, beforeEach, describe, expect, test } from '@jest/globals';
import {
  USER_EMAILS,
  createBlock,
  createUsersForAllRoles,
  loginAs,
  placeContainer,
  resetDatabase,
} from '../helpers/fixtures.js';
import { createTestContext } from '../helpers/test-app.js';

const BLOCKS_PATH = '/api/v1/blocks';
const NEW_BLOCK = {
  code: 'f',
  type: 'EMPTY',
  sizeClass: 'LARGE',
  rows: 4,
  bays: 8,
  maxTier: 5,
  mapX: 340,
  mapY: 20,
  gateDistanceM: 340,
};

describe('blocks', () => {
  const { app, prisma, close } = createTestContext();
  let admin;
  let block;
  let company;

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ company } = await createUsersForAllRoles(prisma));
    block = await createBlock(prisma, { rows: 5, bays: 10, maxTier: 5 });
    await placeContainer(prisma, { block, row: 5, bay: 10, tier: 1, companyId: company.id });
    await placeContainer(prisma, { block, row: 5, bay: 10, tier: 2, companyId: company.id });
    admin = await loginAs(app, USER_EMAILS.ADMIN);
  });

  afterAll(close);

  test('lists blocks with geometry and occupancy for a planner', async () => {
    const planner = await loginAs(app, USER_EMAILS.PLANNER);
    const response = await planner.get(BLOCKS_PATH);
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({
      code: 'B',
      rows: 5,
      bays: 10,
      maxTier: 5,
      occupancy: {
        capacitySlots: 250,
        usedSlots: 2,
        freeSlots: 248,
        occupancyPercent: 0.8,
        teuCapacity: 500,
        teuUsed: 4,
      },
    });
  });

  test('filters blocks by type', async () => {
    await admin.post(BLOCKS_PATH).send(NEW_BLOCK);
    const response = await admin.get(`${BLOCKS_PATH}?type=EMPTY`);
    expect(response.body.data.map((item) => item.code)).toEqual(['F']);
  });

  test('creates a block with an uppercase code and rejects a duplicate code', async () => {
    const created = await admin.post(BLOCKS_PATH).send(NEW_BLOCK);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: 'F', occupancy: { usedSlots: 0 } });
    const duplicate = await admin.post(BLOCKS_PATH).send({ ...NEW_BLOCK, code: 'B' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('BLOCK_CODE_TAKEN');
  });

  test.each([
    [{ rows: 0 }, 'body.rows'],
    [{ maxTier: 10 }, 'body.maxTier'],
    [{ bays: 2.5 }, 'body.bays'],
    [{ code: '1A' }, 'body.code'],
    [{ type: 'REEFER' }, 'body.type'],
  ])('rejects %j with 422', async (changes, field) => {
    const response = await admin.post(BLOCKS_PATH).send({ ...NEW_BLOCK, ...changes });
    expect(response.status).toBe(422);
    expect(response.body.error.details[0].field).toBe(field);
  });

  test('grows a block and moves it on the map', async () => {
    const response = await admin.patch(`${BLOCKS_PATH}/${block.id}`).send({ rows: 6, mapX: 200 });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ rows: 6, mapX: 200, occupancy: { usedSlots: 2 } });
  });

  test.each([
    ['rows', { rows: 4 }, 2],
    ['bays', { bays: 9 }, 2],
    ['maxTier', { maxTier: 1 }, 1],
  ])('refuses to shrink %s when it would cut occupied stacks', async (_label, changes, cut) => {
    const response = await admin.patch(`${BLOCKS_PATH}/${block.id}`).send(changes);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BLOCK_SHRINK_CUTS_STACKS');
    expect(response.body.error.details).toHaveLength(cut);
    expect(response.body.error.details[0].positionCode).toMatch(/^B-05-10-\d$/);
    const unchanged = await prisma.block.findUniqueOrThrow({ where: { id: block.id } });
    expect(unchanged).toMatchObject({ rows: 5, bays: 10, maxTier: 5 });
  });

  test('allows shrinking when no occupied stack is cut', async () => {
    const response = await admin.patch(`${BLOCKS_PATH}/${block.id}`).send({ maxTier: 2 });
    expect(response.status).toBe(200);
  });

  test('refuses to change type or size class while the block holds containers', async () => {
    const response = await admin.patch(`${BLOCKS_PATH}/${block.id}`).send({ type: 'DG' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('BLOCK_NOT_EMPTY');
  });

  test('changes type and size class of an empty block and audits it', async () => {
    const empty = await createBlock(prisma, { code: 'Z' });
    const response = await admin
      .patch(`${BLOCKS_PATH}/${empty.id}`)
      .send({ type: 'DG', sizeClass: 'SMALL' });
    expect(response.body.data).toMatchObject({ type: 'DG', sizeClass: 'SMALL' });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'Block' } });
    expect(audit).toMatchObject({ action: 'UPDATE', entityId: String(empty.id) });
    expect(audit.before.type).toBe('STANDARD');
  });

  test('refuses to change the code and answers 404 for an unknown block', async () => {
    expect((await admin.patch(`${BLOCKS_PATH}/${block.id}`).send({ code: 'Q' })).status).toBe(422);
    expect((await admin.patch(`${BLOCKS_PATH}/999999`).send({ rows: 3 })).status).toBe(404);
  });
});
