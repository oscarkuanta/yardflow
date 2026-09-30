import { formatContainerNumber } from '@yardflow/shared';
import { notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';
import { isCustomer } from '../../lib/scope.js';
import { addCalendarDays, parseCalendarDate, terminalDateTime } from '../../lib/terminal-time.js';
import { buildEirModel, renderEirPdf } from './eir.js';
import { eirUrl } from './gate.service.js';

const LIST_INCLUDE = {
  container: { select: { number: true } },
  operator: { select: { id: true, name: true } },
  _count: { select: { damages: true } },
};

function toTransactionResponse(transaction) {
  return {
    id: transaction.id,
    direction: transaction.direction,
    lane: transaction.lane,
    truckPlate: transaction.truckPlate,
    driverName: transaction.driverName,
    containerNumber: transaction.container.number,
    displayNumber: formatContainerNumber(transaction.container.number),
    operator: transaction.operator,
    noDamage: transaction.noDamage,
    damageCount: transaction._count.damages,
    createdAt: transaction.createdAt,
    eirUrl: eirUrl(transaction.id),
  };
}

function dayRange(dateText) {
  const day = parseCalendarDate(dateText);
  return { gte: terminalDateTime(day, 0), lt: terminalDateTime(addCalendarDays(day, 1), 0) };
}

export function createGateTransactionsService({ prisma }) {
  async function list(query) {
    return paginate(prisma, prisma.gateTransaction, {
      where: {
        direction: query.direction,
        ...(query.date && { createdAt: dayRange(query.date) }),
        ...(query.containerNumber && { container: { number: query.containerNumber } }),
      },
      include: LIST_INCLUDE,
      query,
      present: toTransactionResponse,
    });
  }

  async function eirPdf(id, user) {
    const transaction = await prisma.gateTransaction.findFirst({
      where: { id, ...(isCustomer(user) && { preAdvice: { companyId: user.companyId } }) },
      include: { container: true, operator: true, damages: { orderBy: { id: 'asc' } } },
    });
    if (!transaction) {
      throw notFound('Gate transaction not found');
    }
    const movement = await prisma.movement.findFirst({
      where: {
        containerId: transaction.containerId,
        type: transaction.direction === 'IN' ? 'GATE_IN' : 'GATE_OUT',
        createdAt: transaction.createdAt,
      },
    });
    const model = buildEirModel({
      transaction,
      container: transaction.container,
      operator: transaction.operator,
      damages: transaction.damages,
      positionCode: movement?.toPosition ?? movement?.fromPosition ?? null,
    });
    return renderEirPdf(model);
  }

  return { list, eirPdf };
}
