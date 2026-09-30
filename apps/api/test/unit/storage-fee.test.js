import { describe, expect, test } from '@jest/globals';
import { calculateStorageFee } from '../../src/modules/billing/storage-fee.js';

const TARIFF_20_FT = { freeDays: 5, dailyRateCents: 900 };
const TARIFF_40_FT_DG = { freeDays: 3, dailyRateCents: 3000 };

describe('calculateStorageFee', () => {
  test('charges nothing for a same-day pickup but counts one day', () => {
    expect(
      calculateStorageFee(
        new Date('2026-09-29T10:00:00Z'),
        new Date('2026-09-29T16:00:00Z'),
        TARIFF_20_FT,
      ),
    ).toEqual({
      days: 1,
      freeDays: 5,
      chargeableDays: 0,
      dailyRateCents: 900,
      amountCents: 0,
    });
  });

  test('rounds 6 days and 1 hour up to 7 days for a 20 ft container', () => {
    expect(
      calculateStorageFee(
        new Date('2026-09-01T08:00:00Z'),
        new Date('2026-09-07T09:00:00Z'),
        TARIFF_20_FT,
      ),
    ).toMatchObject({ days: 7, chargeableDays: 2, amountCents: 1800 });
  });

  test('uses 3 free days and the double rate for a 40 ft DG container', () => {
    expect(
      calculateStorageFee(
        new Date('2026-09-01T08:00:00Z'),
        new Date('2026-09-06T08:00:00Z'),
        TARIFF_40_FT_DG,
      ),
    ).toMatchObject({ days: 5, chargeableDays: 2, amountCents: 6000 });
  });

  test('charges nothing for exactly 5 days', () => {
    expect(
      calculateStorageFee(
        new Date('2026-09-01T08:00:00Z'),
        new Date('2026-09-06T08:00:00Z'),
        TARIFF_20_FT,
      ),
    ).toMatchObject({ days: 5, chargeableDays: 0, amountCents: 0 });
  });

  test('counts a zero-length period as one day', () => {
    const moment = new Date('2026-09-01T08:00:00Z');
    expect(calculateStorageFee(moment, moment, TARIFF_20_FT).days).toBe(1);
  });

  test('throws when periodTo is before gateInAt', () => {
    expect(() =>
      calculateStorageFee(
        new Date('2026-09-02T08:00:00Z'),
        new Date('2026-09-01T08:00:00Z'),
        TARIFF_20_FT,
      ),
    ).toThrow('periodTo must not be before gateInAt');
  });
});
