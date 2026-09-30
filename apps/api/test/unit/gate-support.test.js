import { describe, expect, test } from '@jest/globals';
import { retryOnUniqueViolation } from '../../src/lib/unique-retry.js';
import { buildEirModel, renderEirPdf } from '../../src/modules/gate/eir.js';
import {
  forgetVerifiedTruck,
  isVerifiedTruck,
  rememberVerifiedTruck,
} from '../../src/modules/gate/verified-trucks.js';
import { generatePin } from '../../src/modules/preadvices/preadvices.service.js';

const transaction = {
  id: 42,
  createdAt: new Date('2026-09-30T08:20:00Z'),
  direction: 'IN',
  lane: 1,
  truckPlate: 'HH-YF 175',
  driverName: 'Mats Olsen',
};
const container = {
  number: 'HNFU2045711',
  size: 'FT40',
  isHighCube: true,
  loadStatus: 'FULL',
  grossWeightKg: 24500,
  isDangerous: true,
  imoClass: '3',
};

describe('buildEirModel', () => {
  test('lists every field the spec asks for, in English and Berlin time', () => {
    const model = buildEirModel({
      transaction,
      container,
      operator: { name: 'Jonas Reuter' },
      damages: [],
      positionCode: 'B-02-03-1',
    });
    expect(model.terminalName).toBe('YardFlow Demo Terminal');
    expect(Object.fromEntries(model.fields)).toEqual({
      Transaction: '#42',
      'Date and time': '30 Sept 2026, 10:20 (Europe/Berlin)',
      Direction: 'Gate-in',
      Lane: '1',
      Container: 'HNFU 204571 1',
      'Size and type': '40 ft high cube',
      'Load status': 'Full',
      'Gross weight': '24,500 kg',
      'Dangerous goods': 'IMO class 3',
      'Truck plate': 'HH-YF 175',
      Driver: 'Mats Olsen',
      Operator: 'Jonas Reuter',
      Position: 'B-02-03-1',
    });
    expect(model.noDamage).toBe(true);
  });

  test('lists damage per side and code and marks the damaged sides', () => {
    const model = buildEirModel({
      transaction: { ...transaction, direction: 'OUT' },
      container: {
        ...container,
        isHighCube: false,
        isDangerous: false,
        grossWeightKg: null,
        loadStatus: 'EMPTY',
      },
      operator: { name: 'Jonas Reuter' },
      damages: [
        { side: 'LEFT', code: 'DENT', note: 'Near the door' },
        { side: 'LEFT', code: 'RUST', note: null },
        { side: 'TOP', code: 'HOLE', note: null },
      ],
      positionCode: null,
    });
    expect(model.damages).toEqual([
      { side: 'Left', code: 'Dent', note: 'Near the door' },
      { side: 'Left', code: 'Rust', note: '' },
      { side: 'Top', code: 'Hole', note: '' },
    ]);
    expect(model.damagedSides).toEqual(['LEFT', 'TOP']);
    const fields = Object.fromEntries(model.fields);
    expect(fields).toMatchObject({
      Direction: 'Gate-out',
      'Size and type': '40 ft',
      'Load status': 'Empty',
      'Gross weight': 'Not given',
      'Dangerous goods': 'No',
      Position: 'Not recorded',
    });
  });

  test('renders a PDF document', async () => {
    const model = buildEirModel({
      transaction,
      container,
      operator: { name: 'Jonas Reuter' },
      damages: [{ side: 'FRONT', code: 'BROKEN', note: null }],
      positionCode: 'B-02-03-1',
    });
    const pdf = await renderEirPdf(model);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe('verified trucks in the session', () => {
  const now = new Date('2026-09-30T08:00:00Z');

  test('remembers a verified pre-advice for 30 minutes', () => {
    const session = {};
    rememberVerifiedTruck(session, 7, now);
    expect(isVerifiedTruck(session, 7, new Date('2026-09-30T08:30:00Z'))).toBe(true);
    expect(isVerifiedTruck(session, 7, new Date('2026-09-30T08:30:01Z'))).toBe(false);
    expect(isVerifiedTruck(session, 8, now)).toBe(false);
  });

  test('forgets a pre-advice after use and ignores an empty session', () => {
    const session = {};
    forgetVerifiedTruck(session, 7);
    rememberVerifiedTruck(session, 7, now);
    rememberVerifiedTruck(session, 9, now);
    forgetVerifiedTruck(session, 7);
    expect(isVerifiedTruck(session, 7, now)).toBe(false);
    expect(isVerifiedTruck(session, 9, now)).toBe(true);
  });
});

describe('generatePin', () => {
  test('always returns six digits', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generatePin()).toMatch(/^\d{6}$/);
    }
  });
});

describe('retryOnUniqueViolation', () => {
  test('retries after a unique violation and returns the later result', async () => {
    let calls = 0;
    const result = await retryOnUniqueViolation(async () => {
      calls += 1;
      if (calls < 3) {
        throw Object.assign(new Error('taken'), { code: 'P2002' });
      }
      return 'saved';
    });
    expect(result).toBe('saved');
    expect(calls).toBe(3);
  });

  test('gives up after the last attempt and never retries other errors', async () => {
    const taken = Object.assign(new Error('taken'), { code: 'P2002' });
    await expect(retryOnUniqueViolation(() => Promise.reject(taken), 2)).rejects.toBe(taken);
    let calls = 0;
    const broken = new Error('broken');
    await expect(
      retryOnUniqueViolation(() => {
        calls += 1;
        return Promise.reject(broken);
      }),
    ).rejects.toBe(broken);
    expect(calls).toBe(1);
  });
});
