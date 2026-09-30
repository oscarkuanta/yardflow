import { randomInt } from 'node:crypto';
import { formatContainerNumber, normalizeContainerNumber } from '@yardflow/shared';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { NOTIFICATION_NEW } from '../../lib/event-bus.js';
import { paginate } from '../../lib/pagination.js';
import { hashSecret } from '../../lib/passwords.js';
import { isCustomer } from '../../lib/scope.js';
import { calendarDateToDbDate, parseCalendarDate } from '../../lib/terminal-time.js';
import { retryOnUniqueViolation } from '../../lib/unique-retry.js';
import { issueStorageInvoice, nextPreAdviceReference } from '../billing/invoices.js';
import { bookingProblem } from '../timeslots/availability.js';
import { BOOKING_STATUSES } from '../timeslots/timeslots.service.js';
import {
  cancelOpenRelocations,
  publishWorkOrderChanges,
} from '../workorders/workorders.service.js';
import { POSITION_WRITE_TRANSACTION } from '../yard/yard-state.js';
import { slotWindow } from './pre-advice-window.js';
import {
  PRE_ADVICE_INCLUDE,
  toInvoiceSummary,
  toPreAdviceResponse,
} from './preadvices.presenter.js';

const PIN_UPPER_BOUND = 1_000_000;
const DELIVERY_ATTRIBUTES = [
  'size',
  'isHighCube',
  'loadStatus',
  'isDangerous',
  'imoClass',
  'grossWeightKg',
];

export function generatePin() {
  return String(randomInt(0, PIN_UPPER_BOUND)).padStart(6, '0');
}

function companyScope(user) {
  return isCustomer(user) ? { companyId: user.companyId } : {};
}

function deliveryAttributes(input) {
  return Object.fromEntries(DELIVERY_ATTRIBUTES.map((field) => [field, input[field] ?? null]));
}

function buildWhere(query, user) {
  return {
    ...companyScope(user),
    status: query.status,
    type: query.type,
    ...(query.date && { timeSlot: { date: calendarDateToDbDate(parseCalendarDate(query.date)) } }),
    ...(query.search && {
      OR: [
        { reference: { contains: query.search } },
        { containerNumber: { contains: normalizeContainerNumber(query.search) } },
      ],
    }),
  };
}

export function createPreAdvicesService({ prisma, auditService, eventBus, clock, config, expiry }) {
  const toleranceMin = config.gateSlotToleranceMin;
  const present = (preAdvice) => toPreAdviceResponse(preAdvice, toleranceMin);

  async function list(query, user) {
    await expiry.expireOverdue();
    return paginate(prisma, prisma.preAdvice, {
      where: buildWhere(query, user),
      include: PRE_ADVICE_INCLUDE,
      query,
      present,
    });
  }

  async function lockedSlot(transaction, timeSlotId) {
    await transaction.$queryRaw`SELECT id FROM TimeSlot WHERE id = ${timeSlotId} FOR UPDATE`;
    const slot = await transaction.timeSlot.findUnique({ where: { id: timeSlotId } });
    if (!slot) {
      throw validationFailed([{ field: 'body.timeSlotId', message: 'Time slot not found' }]);
    }
    return slot;
  }

  async function assertSlotBookable(transaction, slot, now) {
    const bookedCount = await transaction.preAdvice.count({
      where: { timeSlotId: slot.id, status: { in: BOOKING_STATUSES } },
    });
    const problem = bookingProblem({
      slot,
      slotStart: slotWindow(slot, toleranceMin).startsAt,
      bookedCount,
      now,
    });
    if (problem) {
      throw conflict(problem.code, problem.message);
    }
  }

  async function assertNoActivePreAdvice(transaction, containerNumber) {
    const active = await transaction.preAdvice.findFirst({
      where: { containerNumber, status: 'ACTIVE' },
    });
    if (active) {
      throw conflict('ACTIVE_PRE_ADVICE_EXISTS', 'This container already has an active pre-advice');
    }
  }

  async function pickupContainer(transaction, input, companyId) {
    const container = await transaction.container.findUnique({
      where: { number: input.containerNumber },
    });
    if (!container || container.ownerCompanyId !== companyId) {
      throw notFound('Container not found');
    }
    if (container.state !== 'IN_YARD') {
      throw conflict(
        'CONTAINER_NOT_IN_YARD',
        `${formatContainerNumber(container.number)} is not in the yard yet`,
      );
    }
    return container;
  }

  async function deliveryContainer(transaction, input, companyId) {
    const existing = await transaction.container.findUnique({
      where: { number: input.containerNumber },
    });
    if (existing?.state === 'IN_YARD') {
      throw conflict(
        'CONTAINER_ALREADY_IN_YARD',
        `${formatContainerNumber(existing.number)} is already in the yard`,
      );
    }
    if (existing?.state === 'EXPECTED' && existing.ownerCompanyId !== companyId) {
      throw conflict('CONTAINER_NOT_AVAILABLE', 'This container cannot be booked by your company');
    }
    const data = {
      ...deliveryAttributes(input),
      ownerCompanyId: companyId,
      state: 'EXPECTED',
      gateInAt: null,
      departedAt: null,
    };
    if (existing) {
      return transaction.container.update({ where: { id: existing.id }, data });
    }
    return transaction.container.create({ data: { number: input.containerNumber, ...data } });
  }

  async function createInTransaction(transaction, input, user, { pin, ip }) {
    const now = clock();
    const slot = await lockedSlot(transaction, input.timeSlotId);
    await assertSlotBookable(transaction, slot, now);
    await assertNoActivePreAdvice(transaction, input.containerNumber);
    const container =
      input.type === 'PICKUP'
        ? await pickupContainer(transaction, input, user.companyId)
        : await deliveryContainer(transaction, input, user.companyId);
    const preAdvice = await transaction.preAdvice.create({
      data: {
        reference: await nextPreAdviceReference(transaction, now),
        companyId: user.companyId,
        type: input.type,
        containerNumber: input.containerNumber,
        ...(input.type === 'DELIVERY' && deliveryAttributes(input)),
        truckPlate: input.truckPlate,
        driverName: input.driverName,
        pinHash: await hashSecret(pin),
        timeSlotId: slot.id,
        createdAt: now,
      },
      include: PRE_ADVICE_INCLUDE,
    });
    const billing =
      input.type === 'PICKUP'
        ? await issueStorageInvoice(transaction, {
            container,
            periodTo: slotWindow(slot, toleranceMin).endsAt,
            now,
          })
        : { invoice: null, notification: null };
    await auditService.record(
      {
        userId: user.id,
        action: 'CREATE',
        entity: 'PreAdvice',
        entityId: preAdvice.id,
        after: { ...present(preAdvice), invoiceNumber: billing.invoice?.number ?? null },
        ip,
      },
      transaction,
    );
    return { preAdvice, ...billing };
  }

  async function create(input, user, ip) {
    const pin = generatePin();
    const result = await retryOnUniqueViolation(() =>
      prisma.$transaction(
        (transaction) => createInTransaction(transaction, input, user, { pin, ip }),
        POSITION_WRITE_TRANSACTION,
      ),
    );
    if (result.notification) {
      eventBus.publish(NOTIFICATION_NEW, result.notification);
    }
    return { ...present(result.preAdvice), pin, invoice: toInvoiceSummary(result.invoice) };
  }

  async function findOwnPreAdvice(transaction, id, user) {
    const preAdvice = await transaction.preAdvice.findFirst({
      where: { id, ...companyScope(user) },
      include: PRE_ADVICE_INCLUDE,
    });
    if (!preAdvice) {
      throw notFound('Pre-advice not found');
    }
    if (preAdvice.status !== 'ACTIVE') {
      throw conflict('PRE_ADVICE_NOT_ACTIVE', `This pre-advice is already ${preAdvice.status}`);
    }
    return preAdvice;
  }

  async function regeneratePin(id, user, ip) {
    await expiry.expireOverdue();
    const pin = generatePin();
    const pinHash = await hashSecret(pin);
    const preAdvice = await prisma.$transaction(async (transaction) => {
      await findOwnPreAdvice(transaction, id, user);
      const saved = await transaction.preAdvice.update({
        where: { id },
        data: { pinHash },
        include: PRE_ADVICE_INCLUDE,
      });
      await auditService.record(
        { userId: user.id, action: 'REGENERATE_PIN', entity: 'PreAdvice', entityId: id, ip },
        transaction,
      );
      return saved;
    });
    return { ...present(preAdvice), pin };
  }

  async function cancel(id, user, ip) {
    await expiry.expireOverdue();
    const { preAdvice, cancelled } = await prisma.$transaction(async (transaction) => {
      const existing = await findOwnPreAdvice(transaction, id, user);
      const saved = await transaction.preAdvice.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: PRE_ADVICE_INCLUDE,
      });
      const container = await transaction.container.findUnique({
        where: { number: existing.containerNumber },
      });
      const cancelledOrders =
        existing.type === 'PICKUP' && container
          ? await cancelOpenRelocations(transaction, container.id)
          : [];
      await auditService.record(
        {
          userId: user.id,
          action: 'CANCEL',
          entity: 'PreAdvice',
          entityId: id,
          before: { status: 'ACTIVE' },
          after: { status: 'CANCELLED', cancelledWorkOrders: cancelledOrders.length },
          ip,
        },
        transaction,
      );
      return { preAdvice: saved, cancelled: cancelledOrders };
    });
    publishWorkOrderChanges(eventBus, cancelled);
    return present(preAdvice);
  }

  return { list, create, regeneratePin, cancel };
}
