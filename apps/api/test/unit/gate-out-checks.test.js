import { describe, expect, test } from '@jest/globals';
import { runGateOutChecks } from '../../src/modules/gate/gate-out-checks.js';

const NOW = new Date('2026-09-30T08:20:00Z');

const validPreAdvice = {
  reference: 'PA-20260929-0007',
  type: 'PICKUP',
  status: 'ACTIVE',
  truckPlate: 'HH-YF 482',
  driverName: 'Jan Becker',
  window: {
    opensAt: new Date('2026-09-30T07:30:00Z'),
    closesAt: new Date('2026-09-30T09:30:00Z'),
  },
};
const paidInvoice = {
  number: 'INV-2026-00012',
  status: 'PAID',
  periodTo: new Date('2026-09-30T09:00:00Z'),
};

function runWith(overrides = {}) {
  return runGateOutChecks({
    preAdvice: validPreAdvice,
    truckPlate: 'hh-yf  482',
    driverName: '  JAN BECKER ',
    activeHold: null,
    invoice: paidInvoice,
    now: NOW,
    ...overrides,
  });
}

function checkOf(result, key) {
  return result.checks.find((item) => item.key === key);
}

describe('gate-out checks (spec 8.5)', () => {
  test('passes when all four checks pass, in a fixed order', () => {
    const result = runWith();
    expect(result.passed).toBe(true);
    expect(result.checks.map((item) => [item.key, item.passed])).toEqual([
      ['PRE_ADVICE', true],
      ['TRUCK_DRIVER', true],
      ['CUSTOMS', true],
      ['INVOICE', true],
    ]);
  });

  describe('PRE_ADVICE', () => {
    test.each([
      ['no pre-advice', null, 'No active pickup pre-advice for this truck'],
      [
        'a delivery',
        { ...validPreAdvice, type: 'DELIVERY' },
        'No active pickup pre-advice for this truck',
      ],
      [
        'a used pre-advice',
        { ...validPreAdvice, status: 'USED' },
        'No active pickup pre-advice for this truck',
      ],
      [
        'a truck after the window',
        {
          ...validPreAdvice,
          window: { ...validPreAdvice.window, closesAt: new Date('2026-09-30T08:00:00Z') },
        },
        'The truck is outside its booked time slot',
      ],
      [
        'a truck before the window',
        {
          ...validPreAdvice,
          window: { ...validPreAdvice.window, opensAt: new Date('2026-09-30T09:00:00Z') },
        },
        'The truck is outside its booked time slot',
      ],
    ])('fails alone for %s', (_label, preAdvice, message) => {
      const result = runWith({ preAdvice });
      expect(result.passed).toBe(false);
      expect(checkOf(result, 'PRE_ADVICE')).toEqual({ key: 'PRE_ADVICE', passed: false, message });
      expect(checkOf(result, 'CUSTOMS').passed).toBe(true);
      expect(checkOf(result, 'INVOICE').passed).toBe(true);
    });
  });

  describe('TRUCK_DRIVER', () => {
    test('fails alone when the plate differs', () => {
      const result = runWith({ truckPlate: 'HH-YF 483' });
      expect(result.passed).toBe(false);
      expect(checkOf(result, 'TRUCK_DRIVER').message).toBe(
        'Truck plate does not match the pre-advice',
      );
      expect(result.checks.filter((item) => !item.passed)).toHaveLength(1);
    });

    test('fails alone when the driver differs', () => {
      const result = runWith({ driverName: 'Jana Becker' });
      expect(checkOf(result, 'TRUCK_DRIVER').message).toBe(
        'Driver name does not match the pre-advice',
      );
      expect(result.checks.filter((item) => !item.passed)).toHaveLength(1);
    });
  });

  test('CUSTOMS fails alone with an active hold and names the reason', () => {
    const result = runWith({ activeHold: { reason: 'X-ray inspection requested' } });
    expect(result.passed).toBe(false);
    expect(checkOf(result, 'CUSTOMS')).toEqual({
      key: 'CUSTOMS',
      passed: false,
      message: 'Active customs hold: X-ray inspection requested',
    });
    expect(result.checks.filter((item) => !item.passed)).toHaveLength(1);
  });

  describe('INVOICE', () => {
    test.each([
      ['no invoice', null, 'No storage invoice for this pickup'],
      [
        'an unpaid invoice',
        { ...paidInvoice, status: 'UNPAID' },
        'Storage invoice INV-2026-00012 is not paid',
      ],
      [
        'a paid invoice that ends before now',
        { ...paidInvoice, periodTo: new Date('2026-09-30T08:00:00Z') },
        'Storage invoice INV-2026-00012 does not cover today',
      ],
    ])('fails alone for %s', (_label, invoice, message) => {
      const result = runWith({ invoice });
      expect(result.passed).toBe(false);
      expect(checkOf(result, 'INVOICE')).toEqual({ key: 'INVOICE', passed: false, message });
      expect(result.checks.filter((item) => !item.passed)).toHaveLength(1);
    });

    test('passes when the paid period ends exactly now', () => {
      expect(
        checkOf(runWith({ invoice: { ...paidInvoice, periodTo: NOW } }), 'INVOICE').passed,
      ).toBe(true);
    });
  });
});
