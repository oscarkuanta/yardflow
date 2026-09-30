import { formatCalendarDate, getTerminalParts, terminalDateOf } from '../../lib/terminal-time.js';
import { createNotification } from '../notifications/notifications.js';
import { calculateExtensionFee, calculateStorageFee } from './storage-fee.js';

async function nextRunningNumber(countExisting, prefix, digits) {
  const count = await countExisting(prefix);
  return `${prefix}${String(count + 1).padStart(digits, '0')}`;
}

export function nextInvoiceNumber(transaction, now) {
  return nextRunningNumber(
    (prefix) => transaction.storageInvoice.count({ where: { number: { startsWith: prefix } } }),
    `INV-${getTerminalParts(now).year}-`,
    5,
  );
}

export function nextPreAdviceReference(transaction, now) {
  return nextRunningNumber(
    (prefix) => transaction.preAdvice.count({ where: { reference: { startsWith: prefix } } }),
    `PA-${formatCalendarDate(terminalDateOf(now), '')}-`,
    4,
  );
}

async function tariffFor(transaction, container) {
  return transaction.tariff.findUniqueOrThrow({
    where: { size_isDangerous: { size: container.size, isDangerous: container.isDangerous } },
  });
}

async function saveInvoice(transaction, { container, periodFrom, periodTo, fee, now }) {
  const isFree = fee.amountCents === 0;
  const invoice = await transaction.storageInvoice.create({
    data: {
      number: await nextInvoiceNumber(transaction, now),
      containerId: container.id,
      periodFrom,
      periodTo,
      ...fee,
      status: isFree ? 'PAID' : 'UNPAID',
      paidAt: isFree ? now : null,
      createdAt: now,
    },
  });
  const notification = isFree
    ? null
    : await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'INVOICE_ISSUED',
        containerNumber: container.number,
        details: { invoiceNumber: invoice.number, amountCents: invoice.amountCents },
      });
  return { invoice, notification };
}

export async function issueStorageInvoice(transaction, { container, periodTo, now }) {
  const fee = calculateStorageFee(
    container.gateInAt,
    periodTo,
    await tariffFor(transaction, container),
  );
  return saveInvoice(transaction, {
    container,
    periodFrom: container.gateInAt,
    periodTo,
    fee,
    now,
  });
}

export async function latestInvoice(transaction, containerId) {
  return transaction.storageInvoice.findFirst({
    where: { containerId, status: { in: ['PAID', 'UNPAID'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function ensureInvoiceCovers(transaction, { container, periodTo, now }) {
  const invoice = await latestInvoice(transaction, container.id);
  if (invoice && invoice.periodTo >= now) {
    return { invoice, notification: null };
  }
  if (!invoice) {
    return issueStorageInvoice(transaction, { container, periodTo, now });
  }
  if (invoice.status === 'UNPAID') {
    await transaction.storageInvoice.update({
      where: { id: invoice.id },
      data: { status: 'VOID' },
    });
    return issueStorageInvoice(transaction, { container, periodTo, now });
  }
  const fee = calculateExtensionFee(
    container.gateInAt,
    invoice.periodTo,
    periodTo,
    await tariffFor(transaction, container),
  );
  return saveInvoice(transaction, {
    container,
    periodFrom: invoice.periodTo,
    periodTo,
    fee,
    now,
  });
}
