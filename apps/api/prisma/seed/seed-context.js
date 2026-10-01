import { formatPositionCode, requiredBlockType, requiredSizeClass } from '@yardflow/shared';
import { GATE_LANES } from '../../src/config/terminal.js';
import { calculateStorageFee } from '../../src/modules/billing/storage-fee.js';
import { HOUR_MS, MINUTE_MS, terminalDateOf } from '../../src/lib/terminal-time.js';
import { createNumberFactory, randomDriverName, randomTruckPlate } from './container-factory.js';
import { COMPANIES, DEMO_PICKUP } from './reference-data.js';

const TABLE_NAMES = [
  'companies',
  'users',
  'blocks',
  'tariffs',
  'containers',
  'containerPositions',
  'movements',
  'vesselVisits',
  'vesselVisitItems',
  'timeSlots',
  'preAdvices',
  'gateTransactions',
  'damageReports',
  'customsHolds',
  'storageInvoices',
  'notifications',
  'auditLogs',
];

const COMPANY_SHARE_WEIGHTS = Object.fromEntries(
  COMPANIES.map((company) => [company.code, company.shareWeight]),
);
const DAMAGE_SIDES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'FLOOR'];
const DAMAGE_CODES = ['DENT', 'HOLE', 'RUST', 'BROKEN', 'MISSING'];
const GATE_IN_DAMAGE_PROBABILITY = 0.08;

export function createSeedContext({ now, random }) {
  const tables = Object.fromEntries(TABLE_NAMES.map((name) => [name, []]));
  const lastIds = Object.fromEntries(TABLE_NAMES.map((name) => [name, 0]));

  return {
    now,
    random,
    today: terminalDateOf(now),
    tables,
    containerInfo: new Map(),
    slots: [],
    nextContainerNumber: createNumberFactory(random, [DEMO_PICKUP.containerNumber]),
    insert(table, row) {
      lastIds[table] += 1;
      const stored = { id: lastIds[table], ...row };
      tables[table].push(stored);
      return stored;
    },
  };
}

export function findOne(rows, predicate) {
  const row = rows.find(predicate);
  if (!row) {
    throw new Error('Expected row was not found');
  }
  return row;
}

export function companyByCode(context, code) {
  return findOne(context.tables.companies, (company) => company.code === code);
}

export function userByRole(context, role) {
  return findOne(context.tables.users, (user) => user.role === role);
}

export function blockByCode(context, code) {
  return findOne(context.tables.blocks, (block) => block.code === code);
}

export function randomOwnerId(context) {
  return companyByCode(context, context.random.pickWeighted(COMPANY_SHARE_WEIGHTS)).id;
}

export function tariffFor(context, container) {
  return findOne(
    context.tables.tariffs,
    (tariff) => tariff.size === container.size && tariff.isDangerous === container.isDangerous,
  );
}

export function randomTimeBetween(context, start, end) {
  const earliest = start.getTime();
  const latest = Math.max(earliest, end.getTime());
  const minutes = Math.floor((latest - earliest) / MINUTE_MS);
  return new Date(earliest + context.random.integer(0, minutes) * MINUTE_MS);
}

export function hoursBefore(date, hours) {
  return new Date(date.getTime() - hours * HOUR_MS);
}

export function hoursAfter(date, hours) {
  return new Date(date.getTime() + hours * HOUR_MS);
}

export function addContainer(context, { profile, ownerCompanyId, number, state, role, ...times }) {
  const container = context.insert('containers', {
    number: number ?? context.nextContainerNumber(companyCodeOf(context, ownerCompanyId)),
    ...profile,
    ownerCompanyId,
    state,
    gateInAt: times.gateInAt ?? null,
    departedAt: times.departedAt ?? null,
    createdAt: times.createdAt,
  });
  context.containerInfo.set(container.id, { role, flags: new Set() });
  return container;
}

function companyCodeOf(context, companyId) {
  return findOne(context.tables.companies, (company) => company.id === companyId).code;
}

export function flagContainer(context, container, flag) {
  context.containerInfo.get(container.id).flags.add(flag);
}

export function hasFlag(context, container, flag) {
  return context.containerInfo.get(container.id).flags.has(flag);
}

export function roleOf(context, container) {
  return context.containerInfo.get(container.id).role;
}

export function randomPositionCode(context, container) {
  const blockType = requiredBlockType(container);
  const sizeClass = requiredSizeClass(container);
  const block = context.random.pick(
    context.tables.blocks.filter(
      (candidate) => candidate.type === blockType && candidate.sizeClass === sizeClass,
    ),
  );
  return formatPositionCode({
    blockCode: block.code,
    row: context.random.integer(1, block.rows),
    bay: context.random.integer(1, block.bays),
    tier: context.random.integer(1, block.maxTier),
  });
}

export function addMovement(context, { container, type, fromPosition, toPosition, userId, at }) {
  return context.insert('movements', {
    containerId: container.id,
    type,
    fromPosition: fromPosition ?? null,
    toPosition: toPosition ?? null,
    userId,
    createdAt: at,
  });
}

export function bookSlot(slot) {
  if (slot.bookedCount >= slot.row.capacity) {
    throw new Error(`Time slot ${slot.row.id} is full`);
  }
  slot.bookedCount += 1;
}

function deliveryAttributes(container, type) {
  if (type !== 'DELIVERY') {
    return {
      size: null,
      isHighCube: null,
      loadStatus: null,
      isDangerous: null,
      imoClass: null,
      grossWeightKg: null,
    };
  }
  return {
    size: container.size,
    isHighCube: container.isHighCube,
    loadStatus: container.loadStatus,
    isDangerous: container.isDangerous,
    imoClass: container.imoClass,
    grossWeightKg: container.grossWeightKg,
  };
}

export function addPreAdvice(context, { type, container, slot, status, pin, createdAt, truck }) {
  if (status === 'ACTIVE' || status === 'USED') {
    bookSlot(slot);
  }
  const driver = truck ?? {
    truckPlate: randomTruckPlate(context.random),
    driverName: randomDriverName(context.random),
  };
  return context.insert('preAdvices', {
    reference: null,
    companyId: container.ownerCompanyId,
    type,
    containerNumber: container.number,
    ...deliveryAttributes(container, type),
    truckPlate: driver.truckPlate,
    driverName: driver.driverName,
    pin,
    timeSlotId: slot.row.id,
    status,
    createdAt,
  });
}

function addDamageReports(context, gateTransaction) {
  const count = context.random.integer(1, 2);
  const sides = context.random.shuffle(DAMAGE_SIDES).slice(0, count);
  for (const side of sides) {
    context.insert('damageReports', {
      gateTransactionId: gateTransaction.id,
      side,
      code: context.random.pick(DAMAGE_CODES),
      note: null,
    });
  }
}

export function addGateTransaction(context, { direction, preAdvice, container, at }) {
  const hasDamage = direction === 'IN' && context.random.chance(GATE_IN_DAMAGE_PROBABILITY);
  const operator = context.random.chance(0.85)
    ? userByRole(context, 'GATE_OPERATOR')
    : userByRole(context, 'ADMIN');
  const gateTransaction = context.insert('gateTransactions', {
    direction,
    preAdviceId: preAdvice.id,
    containerId: container.id,
    truckPlate: preAdvice.truckPlate,
    driverName: preAdvice.driverName,
    lane: context.random.pick(GATE_LANES),
    operatorId: operator.id,
    noDamage: !hasDamage,
    createdAt: at,
  });
  if (hasDamage) {
    addDamageReports(context, gateTransaction);
  }
  return gateTransaction;
}

export function addInvoice(context, { container, periodTo, createdAt, paidAt }) {
  const fee = calculateStorageFee(container.gateInAt, periodTo, tariffFor(context, container));
  const isFree = fee.amountCents === 0;
  const isPaid = isFree || paidAt !== null;
  return context.insert('storageInvoices', {
    number: null,
    containerId: container.id,
    periodFrom: container.gateInAt,
    periodTo,
    ...fee,
    status: isPaid ? 'PAID' : 'UNPAID',
    paidMarkedById: isPaid && !isFree ? userByRole(context, 'ADMIN').id : null,
    paidAt: isFree ? createdAt : paidAt,
    createdAt,
  });
}

export function laterOf(first, second) {
  return first > second ? first : second;
}
