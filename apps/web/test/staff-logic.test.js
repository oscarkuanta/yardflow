import { describe, expect, it, vi } from 'vitest';
import { CHECK_DIGIT_VALID, containerNumberFeedback } from '../src/components/Fields.jsx';
import { auditFilters } from '../src/features/admin/AuditLogTab.jsx';
import { capacityTone } from '../src/features/admin/YardDataTabs.jsx';
import {
  euroToCents,
  mondayOf,
  numberFields,
  slotHours,
  userBody,
  weekDates,
} from '../src/features/admin/admin-forms.js';
import { movementLine } from '../src/features/containers/ContainerDrawer.jsx';
import {
  containerMatches,
  damageReports,
  formatContainerParts,
  gateInBody,
  gateInDoneCount,
  gateOutDoneCount,
  relocationsPending,
  slotLabel,
  stepStatuses,
  toggleDamage,
  withLatestStatus,
} from '../src/features/gate/gate-flow.js';
import { dayBalance, hourlyMoves, mergeFeed } from '../src/features/gate/gate-feed.js';
import { kpiTiles, shortDate } from '../src/features/reports/ReportsPage.jsx';
import { itemBody, localInputToIso } from '../src/features/vessels/VesselForms.jsx';
import { arrivalLine } from '../src/features/vessels/VesselsPage.jsx';
import { visitAtBerth } from '../src/features/vessels/vessels-api.js';
import { groupWorkOrders } from '../src/features/work-orders/work-orders-api.js';
import { sideViewTiers } from '../src/features/yard/StackDrawer.jsx';
import { blockOutlineColor } from '../src/features/yard/YardMap.jsx';
import { calloutText } from '../src/features/yard/YardOverviewPage.jsx';
import {
  GATE_AREA_WIDTH,
  layoutBlock,
  layoutYard,
  parseStackCode,
  shadeLevel,
  stackCodeOfPosition,
  stackFill,
  yardTotals,
} from '../src/features/yard/yard-geometry.js';
import { apiRequest, queryString } from '../src/lib/api.js';
import {
  addDaysToCalendarDate,
  describeCargo,
  formatAge,
  formatEuro,
  titleCase,
} from '../src/lib/format.js';
import { queryKeysFor } from '../src/lib/realtime.jsx';
import { jsonResponse } from './render-app.jsx';

function block(overrides = {}) {
  return {
    code: 'A',
    type: 'STANDARD',
    sizeClass: 'SMALL',
    rows: 2,
    bays: 3,
    maxTier: 4,
    mapX: 60,
    mapY: 20,
    occupancy: { teuUsed: 3, teuCapacity: 6, occupancyPercent: 50 },
    stacks: [
      {
        row: 1,
        bay: 1,
        stackCode: 'A-01-01',
        height: 4,
        topSize: 'FT20',
        hasHold: false,
        hasDangerous: false,
      },
      {
        row: 2,
        bay: 3,
        stackCode: 'A-02-03',
        height: 1,
        topSize: 'FT20',
        hasHold: true,
        hasDangerous: false,
      },
    ],
    ...overrides,
  };
}

describe('yard map geometry', () => {
  it('shades stacks in four steps by height', () => {
    expect(shadeLevel(0, 5)).toBe(0);
    expect(shadeLevel(1, 5)).toBe(1);
    expect(shadeLevel(3, 5)).toBe(3);
    expect(shadeLevel(5, 5)).toBe(4);
  });

  it('colours held stacks red and empty stacks neutral', () => {
    expect(stackFill({ height: 2, hasHold: true }, 4).color).toBe('var(--danger)');
    expect(stackFill({ height: 0, hasHold: false }, 4).color).toBe('var(--surface-2)');
    expect(stackFill({ height: 4, hasHold: false }, 4)).toEqual({
      color: 'var(--accent)',
      opacity: 1,
    });
  });

  it('draws every stack of a block, also the empty ones', () => {
    const layout = layoutBlock(block(), { mapX: 60, mapY: 20 });
    expect(layout.cells).toHaveLength(6);
    expect(layout.x).toBe(GATE_AREA_WIDTH);
    const emptyCell = layout.cells.find((cell) => cell.row === 1 && cell.bay === 2);
    expect(emptyCell.stack).toMatchObject({ stackCode: 'A-01-02', height: 0 });
    const lastCell = layout.cells.at(-1);
    expect(lastCell.x).toBeGreaterThan(layout.cells[0].x);
    expect(lastCell.y).toBeGreaterThan(layout.cells[0].y);
  });

  it('places blocks by their map coordinates', () => {
    const map = layoutYard([block(), block({ code: 'B', mapX: 180, sizeClass: 'LARGE' })]);
    const [first, second] = map.layouts;
    expect(second.x).toBeGreaterThan(first.x + first.width);
    expect(map.width).toBeGreaterThan(second.x + second.width);
    expect(layoutYard([]).layouts).toEqual([]);
  });

  it('sums the TEU of all blocks and counts held stacks', () => {
    expect(yardTotals([block(), block()])).toEqual({
      teuUsed: 6,
      teuCapacity: 12,
      percent: 50,
      stacksOnHold: 2,
    });
    expect(yardTotals([]).percent).toBe(0);
  });

  it('turns position codes into stack codes and back', () => {
    expect(stackCodeOfPosition('B-02-05-3')).toBe('B-02-05');
    expect(stackCodeOfPosition(null)).toBeNull();
    expect(parseStackCode('B-02-05')).toEqual({ block: 'B', row: 2, bay: 5 });
  });

  it('outlines DG blocks in warning colour and full blocks by occupancy', () => {
    expect(blockOutlineColor(block({ type: 'DG' }))).toBe('var(--warn)');
    expect(blockOutlineColor(block({ occupancy: { occupancyPercent: 95 } }))).toBe('var(--danger)');
    expect(blockOutlineColor(block({ occupancy: { occupancyPercent: 80 } }))).toBe('var(--warn)');
    expect(blockOutlineColor(block())).toBe('var(--border)');
  });

  it('lists a stack from the top tier down with free tiers', () => {
    const tiers = sideViewTiers({
      maxTier: 3,
      tiers: [{ tier: 1, positionCode: 'A-01-01-1', container: { number: 'X' } }],
    });
    expect(tiers.map((tier) => tier.tier)).toEqual([3, 2, 1]);
    expect(tiers[0].container).toBeNull();
    expect(tiers[2].container.number).toBe('X');
  });

  it('describes a live yard change', () => {
    expect(
      calloutText({ containerNumber: 'HNFU2045711', positionCode: 'B-02-05-2', action: 'PLACED' }),
    ).toBe('HNFU2045711 placed at B-02-05-2');
    expect(calloutText({ containerNumber: 'X', positionCode: 'A-01-01-1', action: 'OTHER' })).toBe(
      'X changed at A-01-01-1',
    );
  });
});

describe('gate flow', () => {
  const preAdvice = { id: 7, containerNumber: 'HNFU2045711', timeSlot: { startHour: 9 } };

  it('marks steps done, active and still to do', () => {
    expect(stepStatuses(['Truck', 'Container', 'Slot'], 1).map((step) => step.status)).toEqual([
      'done',
      'active',
      'todo',
    ]);
  });

  it('only moves past the container step when the number matches the pre-advice', () => {
    const inspection = { noDamage: false, damages: [], note: '' };
    expect(
      gateInDoneCount({ preAdvice: null, typedNumber: '', inspection, selectedSlot: null }),
    ).toBe(0);
    expect(
      gateInDoneCount({
        preAdvice,
        typedNumber: 'HNFU2045712',
        inspection,
        selectedSlot: 'B-01-01-1',
      }),
    ).toBe(1);
    expect(
      gateInDoneCount({ preAdvice, typedNumber: 'hnfu 204571 1', inspection, selectedSlot: null }),
    ).toBe(2);
    expect(
      gateInDoneCount({
        preAdvice,
        typedNumber: 'HNFU2045711',
        inspection: { ...inspection, noDamage: true },
        selectedSlot: null,
      }),
    ).toBe(3);
    expect(
      gateInDoneCount({
        preAdvice,
        typedNumber: 'HNFU2045711',
        inspection: { ...inspection, noDamage: true },
        selectedSlot: 'B-01-01-1',
      }),
    ).toBe(4);
    expect(containerMatches('HNFU 204571 1', preAdvice)).toBe(true);
  });

  it('adds and removes a damage code per side', () => {
    const once = toggleDamage([], 'LEFT', 'DENT');
    expect(once).toEqual([{ side: 'LEFT', code: 'DENT' }]);
    const twice = toggleDamage(once, 'LEFT', 'RUST');
    expect(twice).toHaveLength(2);
    expect(toggleDamage(twice, 'LEFT', 'DENT')).toEqual([{ side: 'LEFT', code: 'RUST' }]);
  });

  it('adds the note to every damage report', () => {
    expect(damageReports([{ side: 'TOP', code: 'HOLE' }], '  roof hole  ')).toEqual([
      { side: 'TOP', code: 'HOLE', note: 'roof hole' },
    ]);
    expect(damageReports([{ side: 'TOP', code: 'HOLE' }], ' ')).toEqual([
      { side: 'TOP', code: 'HOLE' },
    ]);
  });

  it('builds the gate-in request', () => {
    const body = gateInBody({
      preAdvice,
      typedNumber: 'hnfu 204571 1',
      lane: 2,
      inspection: { noDamage: true, damages: [{ side: 'TOP', code: 'HOLE' }], note: '' },
      selectedSlot: 'B-01-01-2',
    });
    expect(body).toEqual({
      preAdviceId: 7,
      containerNumber: 'HNFU2045711',
      lane: 2,
      noDamage: true,
      damages: [],
      to: 'B-01-01-2',
    });
  });

  it('counts relocations that are still open after live updates', () => {
    const relocations = [
      { id: 1, status: 'OPEN' },
      { id: 2, status: 'OPEN' },
    ];
    expect(relocationsPending(relocations, [])).toBe(2);
    expect(relocationsPending(relocations, [{ id: 1, status: 'DONE' }])).toBe(1);
    expect(withLatestStatus(relocations, [{ id: 2, status: 'DONE' }])[1].status).toBe('DONE');
    expect(relocationsPending([], [])).toBe(0);
    expect(relocationsPending(undefined, [])).toBe(0);
  });

  it('allows gate-out completion only when the checks say so', () => {
    expect(gateOutDoneCount({ preAdvice: null })).toBe(0);
    expect(gateOutDoneCount({ preAdvice, checkResult: { canComplete: false } })).toBe(1);
    expect(gateOutDoneCount({ preAdvice, checkResult: { canComplete: true } })).toBe(2);
  });

  it('formats the slot and the container number parts', () => {
    expect(slotLabel({ startHour: 9 })).toBe('09:00–10:00');
    expect(formatContainerParts('HNFU2045711')).toEqual({
      owner: 'HNFU',
      serial: '204571',
      checkDigit: '1',
    });
  });
});

describe('gate feed', () => {
  const transaction = (id, direction, createdAt) => ({
    id,
    direction,
    lane: 1,
    truckPlate: 'HH-AB 1',
    displayNumber: 'HNFU 204571 1',
    createdAt,
    eirUrl: `/eir/${id}`,
  });

  it('mixes stored gate moves with live denials and waits, newest first', () => {
    const feed = mergeFeed(
      [transaction(1, 'IN', '2026-10-01T08:00:00Z')],
      [
        {
          id: 'a',
          kind: 'DENIED',
          containerNumber: 'X',
          lane: 2,
          plate: 'P',
          message: 'Hold',
          at: '2026-10-01T09:00:00Z',
        },
        {
          id: 'b',
          kind: 'IN',
          containerNumber: 'Y',
          lane: 2,
          plate: 'P',
          message: 'In',
          at: '2026-10-01T09:30:00Z',
        },
        {
          id: 'c',
          kind: 'WAITING',
          containerNumber: 'Z',
          lane: 1,
          plate: 'P',
          message: 'Wait',
          at: new Date('2026-10-01T07:00:00Z'),
        },
      ],
    );
    expect(feed.map((item) => item.kind)).toEqual(['DENIED', 'IN', 'WAITING']);
    expect(feed[2].at).toBe('2026-10-01T07:00:00.000Z');
  });

  it('keeps only the latest eight entries', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      transaction(index, 'OUT', `2026-10-01T08:${String(index).padStart(2, '0')}:00Z`),
    );
    const feed = mergeFeed(many, []);
    expect(feed).toHaveLength(8);
    expect(feed[0].id).toBe('transaction-11');
  });

  it('counts gate moves per hour for the last 24 hours', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const buckets = hourlyMoves(
      [
        transaction(1, 'IN', '2026-10-01T11:30:00Z'),
        transaction(2, 'IN', '2026-10-01T11:10:00Z'),
        transaction(3, 'OUT', '2026-09-30T12:30:00Z'),
        transaction(4, 'OUT', '2026-09-30T11:00:00Z'),
        transaction(5, 'OUT', '2026-10-01T12:30:00Z'),
      ],
      now,
    );
    expect(buckets).toHaveLength(24);
    expect(buckets[23]).toBe(2);
    expect(buckets[0]).toBe(1);
    expect(buckets.reduce((sum, value) => sum + value, 0)).toBe(3);
  });

  it('balances gate-ins and gate-outs of the day', () => {
    expect(dayBalance([transaction(1, 'IN'), transaction(2, 'IN'), transaction(3, 'OUT')])).toEqual(
      {
        in: 2,
        out: 1,
        net: 1,
      },
    );
  });
});

describe('work orders', () => {
  it('groups orders by group and only lets the lowest open one be done', () => {
    const groups = groupWorkOrders([
      {
        id: 3,
        groupKey: 'g1',
        sequence: 2,
        status: 'OPEN',
        reason: 'r',
        targetContainerNumber: 'T',
        createdAt: 'x',
      },
      {
        id: 2,
        groupKey: 'g1',
        sequence: 1,
        status: 'DONE',
        reason: 'r',
        targetContainerNumber: 'T',
        createdAt: 'x',
      },
      {
        id: 4,
        groupKey: 'g1',
        sequence: 3,
        status: 'OPEN',
        reason: 'r',
        targetContainerNumber: 'T',
        createdAt: 'x',
      },
      {
        id: 9,
        groupKey: 'g2',
        sequence: 1,
        status: 'DONE',
        reason: 's',
        targetContainerNumber: 'U',
        createdAt: 'y',
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].orders.map((order) => order.sequence)).toEqual([1, 2, 3]);
    expect(groups[0].nextOpenId).toBe(3);
    expect(groups[1].nextOpenId).toBeNull();
  });
});

describe('vessels', () => {
  it('picks the visit at the berth, working before arrived', () => {
    expect(
      visitAtBerth([
        { status: 'ARRIVED', id: 1 },
        { status: 'WORKING', id: 2 },
      ]).id,
    ).toBe(2);
    expect(visitAtBerth([{ status: 'PLANNED' }])).toBeNull();
  });

  it('describes arrival and departure times', () => {
    expect(arrivalLine({ atd: '2026-10-01T10:00:00Z' })).toMatch(/^Departed/);
    expect(arrivalLine({ ata: '2026-10-01T10:00:00Z', etd: '2026-10-01T18:00:00Z' })).toMatch(
      /^Arrived/,
    );
    expect(arrivalLine({ eta: '2026-10-01T10:00:00Z', etd: '2026-10-01T18:00:00Z' })).toMatch(
      /^ETA/,
    );
  });

  it('builds a list item and drops the IMO class for normal cargo', () => {
    const form = {
      containerNumber: 'HNFU2045711',
      size: 'FT40',
      isHighCube: true,
      loadStatus: 'FULL',
      isDangerous: false,
      imoClass: '3',
      grossWeightKg: '21000',
      ownerCode: 'HNF',
    };
    expect(itemBody(form, 'LOAD')).toMatchObject({
      imoClass: null,
      grossWeightKg: 21000,
      direction: 'LOAD',
    });
    expect(itemBody({ ...form, isDangerous: true, grossWeightKg: '' }, 'DISCHARGE')).toMatchObject({
      imoClass: '3',
      grossWeightKg: null,
    });
    expect(localInputToIso('')).toBe('');
    expect(localInputToIso('2026-10-01T10:00')).toMatch(/^2026-10-01T\d\d:00:00.000Z$/);
  });
});

describe('admin forms', () => {
  it('sends a full body for a new user and only changes for an existing one', () => {
    const form = {
      email: 'a@b.example',
      name: 'A',
      role: 'PLANNER',
      companyId: '3',
      isActive: true,
      password: 'secret12',
    };
    expect(userBody(form, null)).toEqual({
      email: 'a@b.example',
      name: 'A',
      role: 'PLANNER',
      companyId: null,
      password: 'secret12',
    });
    const original = {
      email: 'a@b.example',
      name: 'A',
      role: 'CUSTOMER',
      companyId: 3,
      isActive: true,
    };
    expect(
      userBody({ ...form, role: 'CUSTOMER', password: '', isActive: false }, original),
    ).toEqual({ isActive: false });
  });

  it('turns number inputs into numbers and euro into cents', () => {
    expect(numberFields({ rows: '5', code: 'A', bays: '' }, ['rows', 'bays'])).toEqual({
      rows: 5,
      code: 'A',
      bays: '',
    });
    expect(euroToCents('12,50')).toBe(1250);
    expect(euroToCents('9')).toBe(900);
  });

  it('builds the week of a date starting on Monday', () => {
    expect(mondayOf('2026-10-01')).toBe('2026-09-28');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(weekDates('2026-09-28')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(slotHours([[{ startHour: 9 }, { startHour: 8 }], [], [{ startHour: 8 }]])).toEqual([
      8, 9,
    ]);
  });

  it('colours slot capacity by how full it is', () => {
    expect(capacityTone({ capacity: 0, booked: 0 })).toContain('text-muted');
    expect(capacityTone({ capacity: 10, booked: 10, isFull: true })).toContain('danger');
    expect(capacityTone({ capacity: 10, booked: 8, isFull: false })).toContain('warn');
    expect(capacityTone({ capacity: 10, booked: 2, isFull: false })).toContain('accent');
  });

  it('only sends audit filters that are filled', () => {
    expect(auditFilters({ action: ' LOGIN ', entity: '', from: '2026-09-01' })).toEqual({
      action: 'LOGIN',
      from: '2026-09-01',
    });
  });
});

describe('reports', () => {
  const kpis = {
    occupancy: { percent: 65, teuUsed: 1297, teuCapacity: 1994 },
    gateMovesToday: { in: 3, out: 2, total: 5 },
    currentSlot: null,
    openWorkOrders: { count: 0, oldestAgeMinutes: null },
    activeHolds: 5,
    averageDwellDays: 6.8,
  };

  it('shows the six key figures with hints', () => {
    const tiles = kpiTiles(kpis);
    expect(tiles.map((tile) => tile.value)).toEqual(['65.0 %', '5', '—', '0', '5', '6.8 d']);
    expect(tiles[2].hint).toBe('Gate closed');
    expect(tiles[3].hint).toBe('None waiting');
  });

  it('shows the current slot and the oldest open work order', () => {
    const tiles = kpiTiles({
      ...kpis,
      currentSlot: {
        startsAt: '2026-10-01T07:00:00Z',
        endsAt: '2026-10-01T08:00:00Z',
        expectedTrucks: 4,
      },
      openWorkOrders: { count: 2, oldestAgeMinutes: 95 },
    });
    expect(tiles[2]).toMatchObject({ value: '4', hint: '09:00–10:00' });
    expect(tiles[3].hint).toBe('Oldest 1 h');
  });

  it('writes chart dates the German way', () => {
    expect(shortDate('2026-10-01')).toBe('01.10.');
  });
});

describe('small helpers', () => {
  it('formats money, ages, cargo and enum names', () => {
    expect(formatEuro(4500)).toBe('€45.00');
    expect(formatEuro(null)).toBe('—');
    expect(formatAge(null)).toBe('—');
    expect(formatAge(45)).toBe('45 min');
    expect(formatAge(180)).toBe('3 h');
    expect(formatAge(3000)).toBe('2 d');
    expect(describeCargo({ size: 'FT40', isHighCube: true, loadStatus: 'EMPTY' })).toBe(
      "40' · HC · Empty",
    );
    expect(titleCase('GATE_OPERATOR')).toBe('Gate operator');
    expect(addDaysToCalendarDate('2026-09-30', 2)).toBe('2026-10-02');
  });

  it('gives live feedback on a typed container number', () => {
    expect(containerNumberFeedback('HNFU20').error).toBeNull();
    expect(containerNumberFeedback('HNFU2045711')).toEqual({
      error: null,
      hint: CHECK_DIGIT_VALID,
    });
    expect(containerNumberFeedback('HNFU2045712').error).toMatch(/check digit/);
  });

  it('describes movements in the history', () => {
    expect(movementLine({ type: 'GATE_IN', fromPosition: null, toPosition: 'B-01-01-1' })).toBe(
      'Gate-in: outside → B-01-01-1',
    );
  });

  it('builds query strings without empty values', () => {
    expect(queryString({ status: 'OPEN', search: '', page: 2, other: null })).toBe(
      '?status=OPEN&page=2',
    );
    expect(queryString({})).toBe('');
  });

  it('sends a raw CSV body with its content type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, { data: { created: 2 } }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/import', { method: 'POST', text: 'a,b', contentType: 'text/csv' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('text/csv');
    expect(options.body).toBe('a,b');
  });

  it('maps live events to the caches they make stale', () => {
    expect(queryKeysFor('yard:changed')).toContainEqual(['yard']);
    expect(queryKeysFor('workorder:changed')).toContainEqual(['work-orders']);
    expect(queryKeysFor('unknown')).toEqual([]);
  });
});
