import bcrypt from 'bcrypt';

export const BCRYPT_ROUNDS = 10;
const INSERT_CHUNK_SIZE = 500;
const TRANSACTION_TIMEOUT_MS = 120000;

export const INSERT_ORDER = [
  ['company', 'companies'],
  ['user', 'users'],
  ['block', 'blocks'],
  ['tariff', 'tariffs'],
  ['container', 'containers'],
  ['containerPosition', 'containerPositions'],
  ['movement', 'movements'],
  ['vesselVisit', 'vesselVisits'],
  ['vesselVisitItem', 'vesselVisitItems'],
  ['timeSlot', 'timeSlots'],
  ['preAdvice', 'preAdvices'],
  ['gateTransaction', 'gateTransactions'],
  ['damageReport', 'damageReports'],
  ['customsHold', 'customsHolds'],
  ['storageInvoice', 'storageInvoices'],
  ['notification', 'notifications'],
];

const DELETE_ORDER = [
  'auditLog',
  'notification',
  'storageInvoice',
  'customsHold',
  'damageReport',
  'gateTransaction',
  'workOrder',
  'preAdvice',
  'timeSlot',
  'vesselVisitItem',
  'vesselVisit',
  'movement',
  'containerPosition',
  'container',
  'tariff',
  'block',
  'user',
  'company',
];

function createCachedHasher(rounds) {
  const hashBySecret = new Map();
  return async function hashSecret(secret) {
    if (!hashBySecret.has(secret)) {
      hashBySecret.set(secret, await bcrypt.hash(secret, rounds));
    }
    return hashBySecret.get(secret);
  };
}

async function hashSecrets(tables, rounds) {
  const hashSecret = createCachedHasher(rounds);
  const users = [];
  for (const { password, ...user } of tables.users) {
    users.push({ ...user, passwordHash: await hashSecret(password) });
  }
  const preAdvices = [];
  for (const { pin, ...preAdvice } of tables.preAdvices) {
    preAdvices.push({ ...preAdvice, pinHash: await hashSecret(pin) });
  }
  return { ...tables, users, preAdvices };
}

export async function clearDatabase(client) {
  for (const model of DELETE_ORDER) {
    await client[model].deleteMany();
  }
}

async function insertRows(client, model, rows) {
  for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
    await client[model].createMany({ data: rows.slice(start, start + INSERT_CHUNK_SIZE) });
  }
}

export async function writeDataset(prisma, dataset, { bcryptRounds = BCRYPT_ROUNDS } = {}) {
  const tables = await hashSecrets(dataset.tables, bcryptRounds);
  await prisma.$transaction(
    async (transaction) => {
      await clearDatabase(transaction);
      for (const [model, tableName] of INSERT_ORDER) {
        await insertRows(transaction, model, tables[tableName]);
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_TIMEOUT_MS },
  );
}
