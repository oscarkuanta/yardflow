import { describe, expect, jest, test } from '@jest/globals';
import { createEventBus } from '../../../src/lib/event-bus.js';
import { containerBlocked, moveToStackTop } from '../../../src/modules/yard/placement.js';

const container = {
  id: 5,
  position: { block: { code: 'B' }, row: 1, bay: 1, tier: 3 },
};
const block = { id: 2, code: 'B' };
const stack = { row: 2, bay: 4, height: 1 };

function transactionWhoseUpdate(behaviour) {
  return {
    containerPosition: { update: jest.fn(behaviour) },
    movement: { create: jest.fn().mockResolvedValue({}) },
  };
}

describe('moveToStackTop', () => {
  test('puts the container on the next tier and records the movement', async () => {
    const transaction = transactionWhoseUpdate(async () => ({}));
    const toPosition = await moveToStackTop(transaction, {
      container,
      block,
      stack,
      type: 'YARD_MOVE',
      userId: 9,
      at: new Date('2026-09-30T08:00:00Z'),
    });
    expect(toPosition).toBe('B-02-04-2');
    expect(transaction.containerPosition.update).toHaveBeenCalledWith({
      where: { containerId: 5 },
      data: { blockId: 2, row: 2, bay: 4, tier: 2 },
    });
    expect(transaction.movement.create.mock.calls[0][0].data).toMatchObject({
      fromPosition: 'B-01-01-3',
      toPosition: 'B-02-04-2',
    });
  });

  test.each(['P2002', 'P2034'])(
    'answers 409 SLOT_TAKEN when the database reports %s',
    async (code) => {
      const transaction = transactionWhoseUpdate(async () => {
        throw Object.assign(new Error('conflict'), { code });
      });
      await expect(
        moveToStackTop(transaction, { container, block, stack, type: 'YARD_MOVE', userId: 9 }),
      ).rejects.toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
      expect(transaction.movement.create).not.toHaveBeenCalled();
    },
  );

  test('passes other database errors on', async () => {
    const failure = new Error('connection lost');
    const transaction = transactionWhoseUpdate(async () => {
      throw failure;
    });
    await expect(
      moveToStackTop(transaction, { container, block, stack, type: 'YARD_MOVE', userId: 9 }),
    ).rejects.toBe(failure);
  });
});

describe('containerBlocked', () => {
  test('uses the singular for one blocker', () => {
    expect(containerBlocked(1).message).toBe('Container is blocked by 1 container above it');
  });
});

describe('event bus', () => {
  test('delivers events to subscribers until they unsubscribe', () => {
    const eventBus = createEventBus();
    const received = [];
    const unsubscribe = eventBus.subscribe('yard:changed', (payload) => received.push(payload));
    eventBus.publish('yard:changed', { changes: [] });
    unsubscribe();
    eventBus.publish('yard:changed', { changes: ['ignored'] });
    expect(received).toEqual([{ changes: [] }]);
  });
});
