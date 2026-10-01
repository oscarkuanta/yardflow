import { batchesOf, isoOrEmpty, streamCsv } from '../../lib/csv.js';
import { terminalDayRange } from '../../lib/date-range.js';
import { INVOICE_INCLUDE, buildInvoicesWhere } from '../billing/invoices.service.js';
import { toContainerSummary } from '../containers/containers.presenter.js';
import { SUMMARY_INCLUDE, buildContainersWhere } from '../containers/containers.service.js';

const CONTAINER_COLUMNS = [
  'number',
  'size',
  'isHighCube',
  'loadStatus',
  'isDangerous',
  'imoClass',
  'grossWeightKg',
  'state',
  'ownerCode',
  'positionCode',
  'hasHold',
  'gateInAt',
  'departedAt',
  'dwellDays',
];

const MOVEMENT_COLUMNS = [
  'id',
  'createdAt',
  'type',
  'containerNumber',
  'fromPosition',
  'toPosition',
  'userName',
];

const INVOICE_COLUMNS = [
  'number',
  'containerNumber',
  'companyCode',
  'periodFrom',
  'periodTo',
  'days',
  'freeDays',
  'chargeableDays',
  'dailyRateCents',
  'amountCents',
  'amountEur',
  'status',
  'paidAt',
  'createdAt',
];

function containerRow(container, now) {
  const summary = toContainerSummary(container, now);
  return {
    ...summary,
    imoClass: summary.imoClass ?? '',
    grossWeightKg: summary.grossWeightKg ?? '',
    ownerCode: summary.owner.code,
    positionCode: summary.positionCode ?? '',
    gateInAt: isoOrEmpty(summary.gateInAt),
    departedAt: isoOrEmpty(summary.departedAt),
    dwellDays: summary.dwellDays ?? '',
  };
}

function movementRow(movement) {
  return {
    id: movement.id,
    createdAt: movement.createdAt.toISOString(),
    type: movement.type,
    containerNumber: movement.container.number,
    fromPosition: movement.fromPosition ?? '',
    toPosition: movement.toPosition ?? '',
    userName: movement.user.name,
  };
}

function invoiceRow(invoice) {
  return {
    ...invoice,
    containerNumber: invoice.container.number,
    companyCode: invoice.container.ownerCompany.code,
    periodFrom: invoice.periodFrom.toISOString(),
    periodTo: invoice.periodTo.toISOString(),
    amountEur: (invoice.amountCents / 100).toFixed(2),
    paidAt: isoOrEmpty(invoice.paidAt),
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function createExportsService({ prisma, clock }) {
  function containers(response, query, user) {
    const now = clock();
    return streamCsv(response, {
      filename: 'containers.csv',
      columns: CONTAINER_COLUMNS,
      batches: batchesOf(prisma.container, {
        where: buildContainersWhere(query, user),
        include: SUMMARY_INCLUDE,
      }),
      toRow: (container) => containerRow(container, now),
    });
  }

  function movements(response, query) {
    return streamCsv(response, {
      filename: 'movements.csv',
      columns: MOVEMENT_COLUMNS,
      batches: batchesOf(prisma.movement, {
        where: {
          type: query.type,
          createdAt: terminalDayRange(query),
          ...(query.containerNumber && { container: { number: query.containerNumber } }),
        },
        include: { container: { select: { number: true } }, user: { select: { name: true } } },
      }),
      toRow: movementRow,
    });
  }

  function invoices(response, query, user) {
    return streamCsv(response, {
      filename: 'invoices.csv',
      columns: INVOICE_COLUMNS,
      batches: batchesOf(prisma.storageInvoice, {
        where: buildInvoicesWhere(query, user),
        include: INVOICE_INCLUDE,
      }),
      toRow: invoiceRow,
    });
  }

  return { containers, movements, invoices };
}
