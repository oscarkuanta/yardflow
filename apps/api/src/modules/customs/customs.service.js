import { formatContainerNumber } from '@yardflow/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { CONTAINER_CHANGED, NOTIFICATION_NEW, YARD_CHANGED } from '../../lib/event-bus.js';
import { paginate } from '../../lib/pagination.js';
import { containerChange } from '../containers/container-events.js';
import { createNotification } from '../notifications/notifications.js';
import { positionCodeOf } from '../yard/placement.js';

const USER_NAME = { select: { id: true, name: true } };
const HOLD_INCLUDE = {
  container: {
    select: {
      id: true,
      number: true,
      state: true,
      ownerCompanyId: true,
      ownerCompany: { select: { id: true, code: true, name: true } },
      position: { include: { block: { select: { code: true } } } },
    },
  },
  placedBy: USER_NAME,
  releasedBy: USER_NAME,
};
const HOLDABLE_STATES = ['EXPECTED', 'IN_YARD'];

export function toHoldResponse(hold) {
  const { container } = hold;
  return {
    id: hold.id,
    reason: hold.reason,
    isActive: hold.releasedAt === null,
    containerNumber: container.number,
    displayNumber: formatContainerNumber(container.number),
    containerState: container.state,
    positionCode: container.position ? positionCodeOf(container.position) : null,
    owner: container.ownerCompany,
    placedBy: hold.placedBy,
    placedAt: hold.placedAt,
    releasedBy: hold.releasedBy ?? null,
    releasedAt: hold.releasedAt,
  };
}

function yardHoldChange(hold, action) {
  const positionCode = hold.container.position ? positionCodeOf(hold.container.position) : null;
  return positionCode
    ? { changes: [{ positionCode, containerNumber: hold.container.number, action }] }
    : null;
}

export function createCustomsService({ prisma, auditService, eventBus, clock }) {
  function publishHoldChange({ hold, notifications, change, action }) {
    for (const notification of notifications) {
      eventBus.publish(NOTIFICATION_NEW, notification);
    }
    eventBus.publish(CONTAINER_CHANGED, change);
    const yardChange = yardHoldChange(hold, action);
    if (yardChange) {
      eventBus.publish(YARD_CHANGED, yardChange);
    }
  }

  async function list(query) {
    return paginate(prisma, prisma.customsHold, {
      where: {
        ...(query.isActive !== undefined && {
          releasedAt: query.isActive ? null : { not: null },
        }),
        ...(query.containerNumber && { container: { number: query.containerNumber } }),
      },
      include: HOLD_INCLUDE,
      query,
      present: toHoldResponse,
    });
  }

  async function place({ containerNumber, reason }, actor) {
    const result = await prisma.$transaction(async (transaction) => {
      const container = await transaction.container.findUnique({
        where: { number: containerNumber },
      });
      if (!container) {
        throw notFound('Container not found');
      }
      if (!HOLDABLE_STATES.includes(container.state)) {
        throw conflict(
          'CONTAINER_NOT_HOLDABLE',
          'A customs hold can only be placed on an expected container or one in the yard',
        );
      }
      await transaction.$queryRaw`SELECT id FROM Container WHERE id = ${container.id} FOR UPDATE`;
      const active = await transaction.customsHold.findFirst({
        where: { containerId: container.id, releasedAt: null },
      });
      if (active) {
        throw conflict('HOLD_ALREADY_ACTIVE', 'This container already has an active customs hold');
      }
      const hold = await transaction.customsHold.create({
        data: { containerId: container.id, reason, placedById: actor.id, placedAt: clock() },
        include: HOLD_INCLUDE,
      });
      const notification = await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'CUSTOMS_HOLD_PLACED',
        containerNumber,
        details: { reason },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'PLACE_HOLD',
          entity: 'CustomsHold',
          entityId: hold.id,
          after: { containerNumber, reason },
          ip: actor.ip,
        },
        transaction,
      );
      return {
        hold,
        notifications: [notification],
        change: await containerChange(transaction, container),
      };
    });
    publishHoldChange({ ...result, action: 'HOLD_PLACED' });
    return toHoldResponse(result.hold);
  }

  async function readyForPickupNotification(transaction, container) {
    const activePickup = await transaction.preAdvice.findFirst({
      where: { containerNumber: container.number, type: 'PICKUP', status: 'ACTIVE' },
    });
    if (!activePickup) {
      return [];
    }
    return [
      await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'READY_FOR_PICKUP',
        containerNumber: container.number,
      }),
    ];
  }

  async function release(id, actor) {
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.customsHold.findUnique({
        where: { id },
        include: HOLD_INCLUDE,
      });
      if (!existing) {
        throw notFound('Customs hold not found');
      }
      if (existing.releasedAt !== null) {
        throw conflict('HOLD_NOT_ACTIVE', 'This customs hold was already released');
      }
      const hold = await transaction.customsHold.update({
        where: { id },
        data: { releasedAt: clock(), releasedById: actor.id },
        include: HOLD_INCLUDE,
      });
      const { container } = hold;
      const released = await createNotification(transaction, {
        companyId: container.ownerCompanyId,
        type: 'CUSTOMS_HOLD_RELEASED',
        containerNumber: container.number,
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'RELEASE_HOLD',
          entity: 'CustomsHold',
          entityId: id,
          before: { releasedAt: null },
          after: { releasedAt: hold.releasedAt, containerNumber: container.number },
          ip: actor.ip,
        },
        transaction,
      );
      const change = await containerChange(transaction, container);
      const ready = change.hasHold ? [] : await readyForPickupNotification(transaction, container);
      return { hold, notifications: [released, ...ready], change };
    });
    publishHoldChange({ ...result, action: 'HOLD_RELEASED' });
    return toHoldResponse(result.hold);
  }

  return { list, place, release };
}
