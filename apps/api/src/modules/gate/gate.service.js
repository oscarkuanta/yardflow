import { formatContainerNumber } from '@yardflow/shared';
import bcrypt from 'bcrypt';
import { AppError, conflict, notFound } from '../../lib/errors.js';
import {
  CONTAINER_CHANGED,
  GATE_EVENT,
  NOTIFICATION_NEW,
  YARD_CHANGED,
} from '../../lib/event-bus.js';
import { formatTerminalClock } from '../../lib/format.js';
import { calendarDateToDbDate, terminalDateOf } from '../../lib/terminal-time.js';
import { ensureInvoiceCovers } from '../billing/invoices.js';
import { containerChange } from '../containers/container-events.js';
import { createNotification } from '../notifications/notifications.js';
import { isInsideWindow, slotWindow } from '../preadvices/pre-advice-window.js';
import {
  PRE_ADVICE_INCLUDE,
  toInvoiceSummary,
  toPreAdviceResponse,
} from '../preadvices/preadvices.presenter.js';
import {
  publishWorkOrderChanges,
  requestRelocations,
  toWorkOrderResponse,
  waitingForRelocationsMessage,
} from '../workorders/workorders.service.js';
import { placeArrivingContainer, positionCodeOf, yardChanges } from '../yard/placement.js';
import { POSITION_WRITE_TRANSACTION, lockBlocks } from '../yard/yard-state.js';
import { runGateOutChecks } from './gate-out-checks.js';
import { forgetVerifiedTruck, isVerifiedTruck, rememberVerifiedTruck } from './verified-trucks.js';

const DELIVERY_ATTRIBUTES = [
  'size',
  'isHighCube',
  'loadStatus',
  'isDangerous',
  'imoClass',
  'grossWeightKg',
];
const PICKUP_CONTAINER_INCLUDE = {
  position: { include: { block: true } },
  holds: { where: { releasedAt: null }, orderBy: { placedAt: 'asc' } },
};

export function eirUrl(gateTransactionId) {
  return `/api/v1/gate/transactions/${gateTransactionId}/eir.pdf`;
}

function plateLocked(plate, until) {
  return new AppError(
    429,
    'PLATE_LOCKED',
    `Too many wrong PINs for truck ${plate}. Try again after ${formatTerminalClock(until)}`,
  );
}

function presentPickupContainer(container) {
  return {
    number: container.number,
    displayNumber: formatContainerNumber(container.number),
    size: container.size,
    isHighCube: container.isHighCube,
    loadStatus: container.loadStatus,
    isDangerous: container.isDangerous,
    positionCode: container.position ? positionCodeOf(container.position) : null,
    hasHold: container.holds.length > 0,
  };
}

export function createGateService({
  prisma,
  auditService,
  eventBus,
  clock,
  config,
  pinLockout,
  expiry,
}) {
  const toleranceMin = config.gateSlotToleranceMin;

  function publishGateEvent({ id, kind, containerNumber, lane, plate, message, at }) {
    eventBus.publish(GATE_EVENT, { id, kind, containerNumber, lane, plate, message, at });
  }

  async function candidatesFor(plate, type, now) {
    const candidates = await prisma.preAdvice.findMany({
      where: {
        status: 'ACTIVE',
        type,
        truckPlate: plate,
        timeSlot: { date: calendarDateToDbDate(terminalDateOf(now)) },
      },
      include: PRE_ADVICE_INCLUDE,
    });
    return candidates.filter((preAdvice) =>
      isInsideWindow(slotWindow(preAdvice.timeSlot, toleranceMin), now),
    );
  }

  async function firstMatchingPin(candidates, pin) {
    for (const candidate of candidates) {
      if (await bcrypt.compare(pin, candidate.pinHash)) {
        return candidate;
      }
    }
    return null;
  }

  async function recordWrongPin(plate, now, actor) {
    const attemptsLeft = pinLockout.recordFailure(plate, now);
    await auditService.record({
      userId: actor.id,
      action: 'GATE_PIN_FAILED',
      entity: 'TruckPlate',
      entityId: plate,
      after: { attemptsLeft },
      ip: actor.ip,
    });
    if (attemptsLeft === 0) {
      throw plateLocked(plate, pinLockout.lockedUntil(plate, now));
    }
    const noun = attemptsLeft === 1 ? 'attempt' : 'attempts';
    throw conflict('PIN_MISMATCH', `PIN does not match. ${attemptsLeft} ${noun} left`);
  }

  async function verifyTruck({ truckPlate, pin, direction }, actor, session) {
    await expiry.expireOverdue();
    const now = clock();
    const lockedUntil = pinLockout.lockedUntil(truckPlate, now);
    if (lockedUntil) {
      throw plateLocked(truckPlate, lockedUntil);
    }
    const type = direction === 'IN' ? 'DELIVERY' : 'PICKUP';
    const candidates = await candidatesFor(truckPlate, type, now);
    if (candidates.length === 0) {
      throw notFound(
        `No active ${type.toLowerCase()} pre-advice for truck ${truckPlate} in the current time slot`,
      );
    }
    const preAdvice = await firstMatchingPin(candidates, pin);
    if (!preAdvice) {
      await recordWrongPin(truckPlate, now, actor);
    }
    pinLockout.clear(truckPlate);
    await auditService.record({
      userId: actor.id,
      action: 'GATE_TRUCK_VERIFIED',
      entity: 'PreAdvice',
      entityId: preAdvice.id,
      after: { truckPlate, direction },
      ip: actor.ip,
    });
    rememberVerifiedTruck(session, preAdvice.id, now);
    const container =
      type === 'PICKUP'
        ? await prisma.container.findUnique({
            where: { number: preAdvice.containerNumber },
            include: PICKUP_CONTAINER_INCLUDE,
          })
        : null;
    return {
      preAdvice: toPreAdviceResponse(preAdvice, toleranceMin),
      container: container ? presentPickupContainer(container) : null,
    };
  }

  function assertVerified(session, preAdviceId, now) {
    if (!isVerifiedTruck(session, preAdviceId, now)) {
      throw conflict('TRUCK_NOT_VERIFIED', 'Verify the truck plate and PIN first');
    }
  }

  async function activePreAdvice(transaction, preAdviceId, type, now) {
    const preAdvice = await transaction.preAdvice.findUnique({
      where: { id: preAdviceId },
      include: PRE_ADVICE_INCLUDE,
    });
    if (!preAdvice || preAdvice.type !== type || preAdvice.status !== 'ACTIVE') {
      throw conflict(
        'PRE_ADVICE_NOT_ACTIVE',
        `This ${type.toLowerCase()} pre-advice is no longer active`,
      );
    }
    const window = slotWindow(preAdvice.timeSlot, toleranceMin);
    if (!isInsideWindow(window, now)) {
      throw conflict('OUTSIDE_TIME_SLOT', 'The truck is outside its booked time slot');
    }
    return { preAdvice, window };
  }

  async function arrivingContainer(transaction, preAdvice, now) {
    const existing = await transaction.container.findUnique({
      where: { number: preAdvice.containerNumber },
    });
    if (existing?.state === 'IN_YARD') {
      throw conflict(
        'CONTAINER_ALREADY_IN_YARD',
        `${formatContainerNumber(existing.number)} is already in the yard`,
      );
    }
    const data = {
      ...Object.fromEntries(DELIVERY_ATTRIBUTES.map((field) => [field, preAdvice[field]])),
      ownerCompanyId: preAdvice.companyId,
      state: 'IN_YARD',
      gateInAt: now,
      departedAt: null,
    };
    if (existing) {
      return transaction.container.update({ where: { id: existing.id }, data });
    }
    return transaction.container.create({ data: { number: preAdvice.containerNumber, ...data } });
  }

  async function gateIn(input, actor, session) {
    const now = clock();
    assertVerified(session, input.preAdviceId, now);
    const result = await prisma.$transaction(async (transaction) => {
      const { preAdvice } = await activePreAdvice(transaction, input.preAdviceId, 'DELIVERY', now);
      if (input.containerNumber !== preAdvice.containerNumber) {
        throw conflict('CONTAINER_MISMATCH', 'Container number does not match the pre-advice');
      }
      const container = await arrivingContainer(transaction, preAdvice, now);
      const positionCode = await placeArrivingContainer(transaction, {
        container,
        target: input.to,
        type: 'GATE_IN',
        userId: actor.id,
        at: now,
      });
      const gateTransaction = await transaction.gateTransaction.create({
        data: {
          direction: 'IN',
          preAdviceId: preAdvice.id,
          containerId: container.id,
          truckPlate: preAdvice.truckPlate,
          driverName: preAdvice.driverName,
          lane: input.lane,
          operatorId: actor.id,
          noDamage: input.noDamage,
          createdAt: now,
          damages: { create: input.damages },
        },
      });
      await transaction.preAdvice.update({ where: { id: preAdvice.id }, data: { status: 'USED' } });
      const notification = await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'CONTAINER_IN_YARD',
        containerNumber: container.number,
        details: { positionCode },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'GATE_IN',
          entity: 'GateTransaction',
          entityId: gateTransaction.id,
          after: {
            reference: preAdvice.reference,
            containerNumber: container.number,
            positionCode,
            lane: input.lane,
            damages: input.damages,
          },
          ip: actor.ip,
        },
        transaction,
      );
      const change = await containerChange(transaction, container);
      return { gateTransaction, container, positionCode, notification, change };
    }, POSITION_WRITE_TRANSACTION);
    forgetVerifiedTruck(session, input.preAdviceId);
    const { gateTransaction, container, positionCode, notification, change } = result;
    eventBus.publish(YARD_CHANGED, yardChanges(container.number, null, positionCode));
    publishGateEvent({
      id: gateTransaction.id,
      kind: 'IN',
      containerNumber: container.number,
      lane: gateTransaction.lane,
      plate: gateTransaction.truckPlate,
      message: `Gate-in complete · ${positionCode}`,
      at: now,
    });
    eventBus.publish(NOTIFICATION_NEW, notification);
    eventBus.publish(CONTAINER_CHANGED, change);
    return {
      gateTransactionId: gateTransaction.id,
      containerNumber: container.number,
      positionCode,
      eirUrl: eirUrl(gateTransaction.id),
    };
  }

  async function evaluatePickup(transaction, input, now) {
    const preAdvice = await transaction.preAdvice.findUnique({
      where: { id: input.preAdviceId },
      include: PRE_ADVICE_INCLUDE,
    });
    if (!preAdvice || preAdvice.type !== 'PICKUP') {
      throw notFound('Pickup pre-advice not found');
    }
    const window = slotWindow(preAdvice.timeSlot, toleranceMin);
    const container = await transaction.container.findUnique({
      where: { number: preAdvice.containerNumber },
      include: PICKUP_CONTAINER_INCLUDE,
    });
    const canBill =
      preAdvice.status === 'ACTIVE' &&
      isInsideWindow(window, now) &&
      container?.state === 'IN_YARD';
    const billing = canBill
      ? await ensureInvoiceCovers(transaction, { container, periodTo: window.closesAt, now })
      : { invoice: null, notification: null };
    const result = runGateOutChecks({
      preAdvice: { ...preAdvice, window },
      truckPlate: input.truckPlate,
      driverName: input.driverName,
      activeHold: container?.holds[0] ?? null,
      invoice: billing.invoice,
      now,
    });
    return { preAdvice, container, billing, result };
  }

  async function recordDenial(transaction, { preAdvice, result, input, actor }) {
    await auditService.record(
      {
        userId: actor.id,
        action: 'GATE_OUT_DENIED',
        entity: 'PreAdvice',
        entityId: preAdvice.id,
        after: {
          containerNumber: preAdvice.containerNumber,
          truckPlate: input.truckPlate,
          failedChecks: result.checks.filter((item) => !item.passed),
        },
        ip: actor.ip,
      },
      transaction,
    );
  }

  async function checkGateOut(input, actor, session) {
    const now = clock();
    assertVerified(session, input.preAdviceId, now);
    const outcome = await prisma.$transaction(async (transaction) => {
      const evaluation = await evaluatePickup(transaction, input, now);
      if (!evaluation.result.passed) {
        await recordDenial(transaction, { ...evaluation, input, actor });
        return { ...evaluation, relocations: null };
      }
      await lockBlocks(transaction, [evaluation.container.position.blockId]);
      const relocations = await requestRelocations(transaction, {
        container: evaluation.container,
        reason: `Clear the way for pickup ${evaluation.preAdvice.reference}`,
        actor,
        auditService,
      });
      return { ...evaluation, relocations };
    }, POSITION_WRITE_TRANSACTION);
    const { preAdvice, result, relocations, billing } = outcome;
    if (billing.notification) {
      eventBus.publish(NOTIFICATION_NEW, billing.notification);
    }
    const workOrders = relocations?.workOrders ?? [];
    if (relocations?.created) {
      publishWorkOrderChanges(eventBus, workOrders);
    }
    const gateEvent = {
      id: `check-${preAdvice.id}-${now.getTime()}`,
      containerNumber: preAdvice.containerNumber,
      lane: input.lane,
      plate: input.truckPlate,
      at: now,
    };
    if (!result.passed) {
      publishGateEvent({
        ...gateEvent,
        kind: 'DENIED',
        message: result.checks.find((item) => !item.passed).message,
      });
    } else if (workOrders.length > 0) {
      publishGateEvent({
        ...gateEvent,
        kind: 'WAITING',
        message: waitingForRelocationsMessage(workOrders.length),
      });
    }
    return {
      passed: result.passed,
      checks: result.checks,
      invoice: toInvoiceSummary(billing.invoice),
      relocations: workOrders.map(toWorkOrderResponse),
      canComplete: result.passed && workOrders.length === 0,
    };
  }

  async function completeGateOut(input, actor, session) {
    const now = clock();
    assertVerified(session, input.preAdviceId, now);
    const result = await prisma.$transaction(async (transaction) => {
      const {
        preAdvice,
        container,
        result: checks,
      } = await evaluatePickup(transaction, input, now);
      if (!checks.passed) {
        throw conflict(
          'GATE_OUT_DENIED',
          'Gate-out checks failed, run the checks again',
          checks.checks.filter((item) => !item.passed),
        );
      }
      await lockBlocks(transaction, [container.position.blockId]);
      const relocations = await requestRelocations(transaction, {
        container,
        reason: `Clear the way for pickup ${preAdvice.reference}`,
        actor,
        auditService,
      });
      if (relocations) {
        throw conflict(
          'RELOCATION_PENDING',
          waitingForRelocationsMessage(relocations.workOrders.length),
          relocations.workOrders.map(toWorkOrderResponse),
        );
      }
      const fromPosition = positionCodeOf(container.position);
      await transaction.containerPosition.delete({ where: { containerId: container.id } });
      await transaction.container.update({
        where: { id: container.id },
        data: { state: 'DEPARTED', departedAt: now },
      });
      const gateTransaction = await transaction.gateTransaction.create({
        data: {
          direction: 'OUT',
          preAdviceId: preAdvice.id,
          containerId: container.id,
          truckPlate: preAdvice.truckPlate,
          driverName: preAdvice.driverName,
          lane: input.lane,
          operatorId: actor.id,
          noDamage: true,
          createdAt: now,
        },
      });
      await transaction.movement.create({
        data: {
          containerId: container.id,
          type: 'GATE_OUT',
          fromPosition,
          userId: actor.id,
          createdAt: now,
        },
      });
      await transaction.preAdvice.update({ where: { id: preAdvice.id }, data: { status: 'USED' } });
      const notification = await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'GATE_OUT_DONE',
        containerNumber: container.number,
        details: { truckPlate: preAdvice.truckPlate },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'GATE_OUT',
          entity: 'GateTransaction',
          entityId: gateTransaction.id,
          after: {
            reference: preAdvice.reference,
            containerNumber: container.number,
            fromPosition,
          },
          ip: actor.ip,
        },
        transaction,
      );
      const change = await containerChange(transaction, { ...container, state: 'DEPARTED' });
      return { gateTransaction, container, fromPosition, notification, change };
    }, POSITION_WRITE_TRANSACTION);
    forgetVerifiedTruck(session, input.preAdviceId);
    const { gateTransaction, container, fromPosition, notification, change } = result;
    eventBus.publish(YARD_CHANGED, yardChanges(container.number, fromPosition, null));
    publishGateEvent({
      id: gateTransaction.id,
      kind: 'OUT',
      containerNumber: container.number,
      lane: gateTransaction.lane,
      plate: gateTransaction.truckPlate,
      message: `Gate-out complete · ${formatContainerNumber(container.number)}`,
      at: now,
    });
    eventBus.publish(NOTIFICATION_NEW, notification);
    eventBus.publish(CONTAINER_CHANGED, change);
    return {
      gateTransactionId: gateTransaction.id,
      containerNumber: container.number,
      fromPosition,
      eirUrl: eirUrl(gateTransaction.id),
    };
  }

  return { verifyTruck, gateIn, checkGateOut, completeGateOut };
}
