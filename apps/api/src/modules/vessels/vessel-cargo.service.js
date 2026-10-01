import { formatContainerNumber } from '@yardflow/shared';
import { conflict, notFound } from '../../lib/errors.js';
import {
  CONTAINER_CHANGED,
  NOTIFICATION_NEW,
  VESSEL_CHANGED,
  YARD_CHANGED,
} from '../../lib/event-bus.js';
import { containerChange } from '../containers/container-events.js';
import { createNotification } from '../notifications/notifications.js';
import {
  publishWorkOrderChanges,
  relocationPending,
  requestRelocations,
} from '../workorders/workorders.service.js';
import { placeArrivingContainer, positionCodeOf, yardChanges } from '../yard/placement.js';
import { POSITION_WRITE_TRANSACTION, lockBlocks } from '../yard/yard-state.js';
import { isAtBerth, statusAfterCargoWork } from './vessel-status.js';
import { attributesOf, findVisitOrThrow, vesselProgress } from './vessel-queries.js';

async function findCargoItem(transaction, { visitId, itemId, direction }) {
  const visit = await findVisitOrThrow(transaction, visitId);
  if (!isAtBerth(visit.status)) {
    throw conflict(
      'VISIT_NOT_AT_BERTH',
      `Cargo can only be confirmed while the vessel is at berth, this visit is ${visit.status}`,
    );
  }
  const item = await transaction.vesselVisitItem.findFirst({ where: { id: itemId, visitId } });
  if (!item) {
    throw notFound('Item not found on this visit');
  }
  if (item.direction !== direction) {
    throw conflict('WRONG_DIRECTION', `This item is on the ${item.direction.toLowerCase()} list`);
  }
  if (item.status === 'DONE') {
    throw conflict('ITEM_ALREADY_DONE', 'This item is already done');
  }
  return { visit, item };
}

async function markItemDone(transaction, { visit, item, containerId, at }) {
  await transaction.vesselVisitItem.update({
    where: { id: item.id },
    data: { status: 'DONE', doneAt: at, containerId },
  });
  const nextStatus = statusAfterCargoWork(visit.status);
  if (nextStatus === visit.status) {
    return visit;
  }
  return transaction.vesselVisit.update({ where: { id: visit.id }, data: { status: nextStatus } });
}

async function arrivingContainer(transaction, item, now) {
  const existing = await transaction.container.findUnique({
    where: { number: item.containerNumber },
  });
  if (existing?.state === 'IN_YARD') {
    throw conflict(
      'CONTAINER_ALREADY_IN_YARD',
      `${formatContainerNumber(item.containerNumber)} is already in the yard`,
    );
  }
  const data = {
    ...attributesOf(item),
    ownerCompanyId: item.ownerCompanyId,
    state: 'IN_YARD',
    gateInAt: now,
    departedAt: null,
  };
  if (existing) {
    return transaction.container.update({ where: { id: existing.id }, data });
  }
  return transaction.container.create({ data: { number: item.containerNumber, ...data } });
}

async function loadableContainer(transaction, item) {
  const container = await transaction.container.findUnique({
    where: { number: item.containerNumber },
    include: {
      position: { include: { block: true } },
      holds: { where: { releasedAt: null }, select: { id: true } },
    },
  });
  const displayNumber = formatContainerNumber(item.containerNumber);
  if (!container || container.state !== 'IN_YARD' || !container.position) {
    throw conflict('CONTAINER_NOT_IN_YARD', `${displayNumber} is not in the yard`);
  }
  if (container.holds.length > 0) {
    throw conflict(
      'CUSTOMS_HOLD_ACTIVE',
      `${displayNumber} has an active customs hold and cannot be loaded`,
    );
  }
  return container;
}

export function createVesselCargoService({ prisma, auditService, eventBus, clock }) {
  async function confirmDischarge({ visitId, itemId, target }, actor) {
    const result = await prisma.$transaction(async (transaction) => {
      const { visit, item } = await findCargoItem(transaction, {
        visitId,
        itemId,
        direction: 'DISCHARGE',
      });
      const now = clock();
      const container = await arrivingContainer(transaction, item, now);
      const positionCode = await placeArrivingContainer(transaction, {
        container,
        target,
        type: 'DISCHARGE',
        userId: actor.id,
        at: now,
      });
      const updatedVisit = await markItemDone(transaction, {
        visit,
        item,
        containerId: container.id,
        at: now,
      });
      const notification = await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'CONTAINER_IN_YARD',
        containerNumber: container.number,
        details: { positionCode },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'DISCHARGE',
          entity: 'VesselVisitItem',
          entityId: item.id,
          after: { visitId, containerNumber: container.number, positionCode },
          ip: actor.ip,
        },
        transaction,
      );
      return {
        containerNumber: container.number,
        positionCode,
        notification,
        change: await containerChange(transaction, container),
        progress: await vesselProgress(transaction, updatedVisit),
      };
    }, POSITION_WRITE_TRANSACTION);
    eventBus.publish(YARD_CHANGED, yardChanges(result.containerNumber, null, result.positionCode));
    eventBus.publish(VESSEL_CHANGED, result.progress);
    eventBus.publish(NOTIFICATION_NEW, result.notification);
    eventBus.publish(CONTAINER_CHANGED, result.change);
    return {
      itemId,
      containerNumber: result.containerNumber,
      positionCode: result.positionCode,
      visit: result.progress,
    };
  }

  async function confirmLoad({ visitId, itemId }, actor) {
    const outcome = await prisma.$transaction(async (transaction) => {
      const { visit, item } = await findCargoItem(transaction, {
        visitId,
        itemId,
        direction: 'LOAD',
      });
      const container = await loadableContainer(transaction, item);
      await lockBlocks(transaction, [container.position.blockId]);
      const relocations = await requestRelocations(transaction, {
        container,
        reason: `Clear the way to load onto ${visit.vesselName} ${visit.voyage}`,
        actor,
        auditService,
      });
      if (relocations) {
        return { relocations };
      }
      const now = clock();
      const fromPosition = positionCodeOf(container.position);
      await transaction.containerPosition.delete({ where: { containerId: container.id } });
      await transaction.container.update({
        where: { id: container.id },
        data: { state: 'DEPARTED', departedAt: now },
      });
      await transaction.movement.create({
        data: {
          containerId: container.id,
          type: 'LOAD',
          fromPosition,
          userId: actor.id,
          createdAt: now,
        },
      });
      const updatedVisit = await markItemDone(transaction, {
        visit,
        item,
        containerId: container.id,
        at: now,
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'LOAD',
          entity: 'VesselVisitItem',
          entityId: item.id,
          after: { visitId, containerNumber: container.number, fromPosition },
          ip: actor.ip,
        },
        transaction,
      );
      return {
        containerNumber: container.number,
        fromPosition,
        change: await containerChange(transaction, { ...container, state: 'DEPARTED' }),
        progress: await vesselProgress(transaction, updatedVisit),
      };
    }, POSITION_WRITE_TRANSACTION);
    if (outcome.relocations) {
      const { workOrders, created } = outcome.relocations;
      if (created) {
        publishWorkOrderChanges(eventBus, workOrders);
      }
      throw relocationPending(workOrders);
    }
    eventBus.publish(
      YARD_CHANGED,
      yardChanges(outcome.containerNumber, outcome.fromPosition, null),
    );
    eventBus.publish(VESSEL_CHANGED, outcome.progress);
    eventBus.publish(CONTAINER_CHANGED, outcome.change);
    return {
      itemId,
      containerNumber: outcome.containerNumber,
      fromPosition: outcome.fromPosition,
      visit: outcome.progress,
    };
  }

  return { confirmDischarge, confirmLoad };
}
