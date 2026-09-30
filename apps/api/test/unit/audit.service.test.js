import { describe, expect, jest, test } from '@jest/globals';
import {
  createAuditService,
  removeSensitiveFields,
} from '../../src/modules/audit/audit.service.js';

describe('removeSensitiveFields', () => {
  test('removes passwords, PINs and their hashes at every depth', () => {
    expect(
      removeSensitiveFields({
        email: 'a@b.example',
        passwordHash: 'x',
        password: 'y',
        preAdvice: { reference: 'PA-20260930-0001', pin: '482913', pinHash: 'z' },
        items: [{ pinHash: 'z', id: 1 }],
      }),
    ).toEqual({
      email: 'a@b.example',
      preAdvice: { reference: 'PA-20260930-0001' },
      items: [{ id: 1 }],
    });
  });

  test('turns dates into ISO strings and keeps plain values', () => {
    expect(
      removeSensitiveFields({ at: new Date('2026-09-30T08:00:00Z'), count: 2, note: null }),
    ).toEqual({ at: '2026-09-30T08:00:00.000Z', count: 2, note: null });
  });
});

describe('audit service', () => {
  test('writes one row with the entity id as a string and without secrets', async () => {
    const create = jest.fn().mockResolvedValue({ id: 1 });
    const auditService = createAuditService({ prisma: { auditLog: { create } } });
    await auditService.record({
      userId: 4,
      action: 'UPDATE',
      entity: 'User',
      entityId: 9,
      before: { name: 'Old', passwordHash: 'x' },
      after: { name: 'New' },
      ip: '127.0.0.1',
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 4,
        action: 'UPDATE',
        entity: 'User',
        entityId: '9',
        before: { name: 'Old' },
        after: { name: 'New' },
        ip: '127.0.0.1',
      },
    });
  });

  test('leaves empty JSON columns out and uses the given transaction client', async () => {
    const create = jest.fn();
    const auditService = createAuditService({ prisma: { auditLog: { create: jest.fn() } } });
    await auditService.record(
      { action: 'LOGOUT', entity: 'User', entityId: 1 },
      { auditLog: { create } },
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: 'LOGOUT',
        entity: 'User',
        entityId: '1',
        before: undefined,
        after: undefined,
        ip: null,
      },
    });
  });
});
