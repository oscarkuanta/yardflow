import { describe, expect, test } from '@jest/globals';
import {
  csvBoolean,
  csvNumberOrNull,
  duplicateRowProblems,
  readItemsCsv,
  validateItemRows,
} from '../../src/modules/vessels/vessel-items.js';
import {
  isAtBerth,
  statusAfterCargoWork,
  statusChangeProblem,
} from '../../src/modules/vessels/vessel-status.js';

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);
const HEADER =
  'containerNumber,size,isHighCube,loadStatus,isDangerous,imoClass,grossWeightKg,ownerCode,direction';

describe('vessel status rules (spec 6.12)', () => {
  test.each([
    ['PLANNED', 'ARRIVED'],
    ['ARRIVED', 'DEPARTED'],
    ['WORKING', 'DEPARTED'],
  ])('allows %s to %s', (from, to) => {
    expect(statusChangeProblem({ from, to, pendingLoadCount: 0 })).toBeNull();
  });

  test.each([
    ['PLANNED', 'DEPARTED'],
    ['ARRIVED', 'ARRIVED'],
    ['WORKING', 'ARRIVED'],
    ['PLANNED', 'WORKING'],
  ])('refuses %s to %s', (from, to) => {
    expect(statusChangeProblem({ from, to, pendingLoadCount: 0 }).code).toBe(
      'INVALID_STATUS_CHANGE',
    );
  });

  test('refuses to depart with pending load items unless the planner confirms', () => {
    expect(statusChangeProblem({ from: 'WORKING', to: 'DEPARTED', pendingLoadCount: 2 })).toEqual({
      code: 'LOAD_ITEMS_PENDING',
      message: '2 load items are still pending. Confirm "Depart with open items" to depart anyway',
    });
    expect(
      statusChangeProblem({ from: 'WORKING', to: 'DEPARTED', pendingLoadCount: 1 }).message,
    ).toContain('1 load item is still pending');
    expect(
      statusChangeProblem({
        from: 'WORKING',
        to: 'DEPARTED',
        pendingLoadCount: 2,
        departWithOpenItems: true,
      }),
    ).toBeNull();
  });

  test('moves ARRIVED to WORKING on the first cargo work and keeps other statuses', () => {
    expect(statusAfterCargoWork('ARRIVED')).toBe('WORKING');
    expect(statusAfterCargoWork('WORKING')).toBe('WORKING');
  });

  test('is at berth only when ARRIVED or WORKING', () => {
    expect(['PLANNED', 'ARRIVED', 'WORKING', 'DEPARTED'].map(isAtBerth)).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});

describe('CSV values', () => {
  test.each([
    ['true', true],
    ['YES', true],
    ['1', true],
    ['false', false],
    [' no ', false],
    ['0', false],
    ['', undefined],
    ['maybe', 'maybe'],
  ])('reads %p as boolean %p', (value, expected) => {
    expect(csvBoolean(value)).toBe(expected);
  });

  test.each([
    ['', null],
    ['24500', 24500],
    ['24.5t', '24.5t'],
  ])('reads %p as number or null %p', (value, expected) => {
    expect(csvNumberOrNull(value)).toBe(expected);
  });
});

describe('readItemsCsv', () => {
  test('reads rows with their line numbers, skipping empty lines', () => {
    const csv = `${HEADER}\nCSQU3054383,ft40,yes,full,no,,24500,hnf,discharge\n\nHNFU2045711,FT20,false,EMPTY,false,,,NRT,LOAD\n`;
    const { rows, problems } = readItemsCsv(csv);
    expect(problems).toEqual([]);
    expect(rows.map((row) => row.line)).toEqual([2, 4]);
    expect(rows[0].input).toEqual({
      containerNumber: 'CSQU3054383',
      size: 'FT40',
      isHighCube: true,
      loadStatus: 'FULL',
      isDangerous: false,
      imoClass: null,
      grossWeightKg: 24500,
      ownerCode: 'hnf',
      direction: 'DISCHARGE',
    });
  });

  test('accepts the columns in any order and a byte order mark', () => {
    const csv = `${BYTE_ORDER_MARK}direction,ownerCode,grossWeightKg,imoClass,isDangerous,loadStatus,isHighCube,size,containerNumber
LOAD,HNF,,,false,FULL,false,FT40,CSQU3054383`;
    expect(readItemsCsv(csv).rows).toHaveLength(1);
  });

  test('reports missing and unexpected columns on line 1', () => {
    const { problems } = readItemsCsv('containerNumber,size,colour\nCSQU3054383,FT40,red');
    expect(problems).toContainEqual({
      line: 1,
      field: 'direction',
      message: 'Column direction is missing',
    });
    expect(problems).toContainEqual({
      line: 1,
      field: 'colour',
      message: 'Column colour is not expected',
    });
  });

  test('reports a file without rows and a broken file', () => {
    expect(readItemsCsv(HEADER).problems[0].message).toBe('The file has no rows');
    expect(readItemsCsv(`${HEADER}\n"unclosed,FT40`).problems[0].field).toBe('file');
  });
});

describe('validateItemRows', () => {
  function rowWith(overrides) {
    return {
      line: 7,
      input: {
        containerNumber: 'CSQU3054383',
        size: 'FT40',
        isHighCube: false,
        loadStatus: 'FULL',
        isDangerous: false,
        imoClass: null,
        grossWeightKg: 24000,
        ownerCode: 'HNF',
        direction: 'DISCHARGE',
        ...overrides,
      },
    };
  }

  test('accepts a valid row and normalizes the number and owner code', () => {
    const { items, problems } = validateItemRows([
      rowWith({ containerNumber: 'csqu 305438 3', ownerCode: 'hnf' }),
    ]);
    expect(problems).toEqual([]);
    expect(items[0].value).toMatchObject({ containerNumber: 'CSQU3054383', ownerCode: 'HNF' });
  });

  test.each([
    [
      { containerNumber: 'CSQU3054384' },
      'containerNumber',
      'Invalid container number: check digit does not match',
    ],
    [{ size: 'FT30' }, 'size', 'Size must be FT20, FT40 or FT45'],
    [{ isHighCube: 'maybe' }, 'isHighCube', 'isHighCube must be true or false'],
    [{ isDangerous: true }, 'imoClass', 'Dangerous goods need an IMO class'],
    [{ imoClass: '3' }, 'imoClass', 'Only dangerous goods have an IMO class'],
    [{ isDangerous: true, imoClass: '10' }, 'imoClass', 'IMO class must look like 3 or 2.1'],
    [{ grossWeightKg: 90000 }, 'grossWeightKg', 'Gross weight must be at most 60000 kg'],
    [
      { grossWeightKg: '24.5t' },
      'grossWeightKg',
      'Gross weight must be a whole number of kilograms',
    ],
    [{ direction: 'TRANSFER' }, 'direction', 'Direction must be DISCHARGE or LOAD'],
  ])('reports %j on its line and field', (overrides, field, message) => {
    const { items, problems } = validateItemRows([rowWith(overrides)]);
    expect(items).toEqual([]);
    expect(problems).toContainEqual({ line: 7, field, message });
  });

  test('accepts a dangerous container with a sub class', () => {
    const { problems } = validateItemRows([rowWith({ isDangerous: true, imoClass: '2.1' })]);
    expect(problems).toEqual([]);
  });
});

describe('duplicateRowProblems', () => {
  test('reports the same container and direction twice, but allows discharge and load', () => {
    const value = { containerNumber: 'CSQU3054383', direction: 'DISCHARGE' };
    const problems = duplicateRowProblems([
      { line: 2, value },
      { line: 3, value: { ...value, direction: 'LOAD' } },
      { line: 4, value },
    ]);
    expect(problems).toEqual([
      { line: 4, field: 'containerNumber', message: 'Same container and direction as line 2' },
    ]);
  });
});
