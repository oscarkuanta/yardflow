import { describe, expect, test } from '@jest/globals';
import { calculateExtensionFee } from '../../src/modules/billing/storage-fee.js';
import { createPinLockout } from '../../src/modules/gate/pin-lockout.js';

const MINUTE = 60 * 1000;

describe('PIN lockout', () => {
  const start = new Date('2026-09-30T08:00:00Z');
  const at = (minutes) => new Date(start.getTime() + minutes * MINUTE);

  test('locks a plate for 15 minutes after five wrong PINs within 15 minutes', () => {
    const lockout = createPinLockout();
    expect([0, 1, 2, 3].map((minute) => lockout.recordFailure('HH-YF 482', at(minute)))).toEqual([
      4, 3, 2, 1,
    ]);
    expect(lockout.lockedUntil('HH-YF 482', at(4))).toBeNull();
    expect(lockout.recordFailure('HH-YF 482', at(4))).toBe(0);
    expect(lockout.lockedUntil('HH-YF 482', at(10))).toEqual(at(19));
    expect(lockout.lockedUntil('HH-YF 482', at(19))).toBeNull();
  });

  test('forgets wrong PINs older than 15 minutes', () => {
    const lockout = createPinLockout();
    for (const minute of [0, 1, 2, 3]) {
      lockout.recordFailure('HH-YF 482', at(minute));
    }
    expect(lockout.recordFailure('HH-YF 482', at(20))).toBe(4);
    expect(lockout.lockedUntil('HH-YF 482', at(20))).toBeNull();
  });

  test('keeps plates apart and clears a plate after a correct PIN', () => {
    const lockout = createPinLockout();
    for (const minute of [0, 1, 2, 3, 4]) {
      lockout.recordFailure('HH-AA 1', at(minute));
    }
    expect(lockout.lockedUntil('HH-BB 2', at(5))).toBeNull();
    lockout.recordFailure('HH-BB 2', at(5));
    lockout.clear('HH-BB 2');
    expect(lockout.recordFailure('HH-BB 2', at(6))).toBe(4);
  });
});

describe('calculateExtensionFee', () => {
  const tariff = { freeDays: 5, dailyRateCents: 1500 };
  const gateInAt = new Date('2026-09-20T10:00:00Z');

  test('charges only the days after the billed period', () => {
    expect(
      calculateExtensionFee(
        gateInAt,
        new Date('2026-09-27T10:00:00Z'),
        new Date('2026-09-29T11:00:00Z'),
        tariff,
      ),
    ).toEqual({ days: 3, freeDays: 0, chargeableDays: 3, dailyRateCents: 1500, amountCents: 4500 });
  });

  test('keeps free days free when the extension still falls inside them', () => {
    expect(
      calculateExtensionFee(
        gateInAt,
        new Date('2026-09-21T10:00:00Z'),
        new Date('2026-09-23T10:00:00Z'),
        tariff,
      ),
    ).toMatchObject({ days: 2, freeDays: 2, chargeableDays: 0, amountCents: 0 });
  });

  test('charges nothing for a few extra minutes on the same day', () => {
    expect(
      calculateExtensionFee(
        gateInAt,
        new Date('2026-09-27T09:00:00Z'),
        new Date('2026-09-27T09:20:00Z'),
        tariff,
      ),
    ).toMatchObject({ days: 0, amountCents: 0 });
  });

  test('throws when periodTo is before the billed period ends', () => {
    expect(() =>
      calculateExtensionFee(gateInAt, new Date('2026-09-27T10:00:00Z'), gateInAt, tariff),
    ).toThrow('periodTo must not be before billedUntil');
  });
});
