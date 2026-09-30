import { randomUUID } from 'node:crypto';
import { formatContainerNumber, formatPositionCode, parsePositionCode } from '@yardflow/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { WORK_ORDER_CHANGED, YARD_CHANGED } from '../../lib/event-bus.js';
import { paginate } from '../../lib/pagination.js';
import {
  containerBlocked,
  moveToStackTop,
  positionCodeOf,
  yardChanges,
} from '../yard/placement.js';
import { planBlockers, planRelocationDestinations } from '../yard/rehandle.js';
import { suggestSlots } from '../yard/slot-suggestion.js';
import { stackingProblems } from '../yard/stacking-rules.js';
import { stackKey } from '../yard/stacks.js';
import { loadStack, loadYard, lockBlocks, POSITION_WRITE_TRANSACTION } from '../yard/yard-state.js';
import { noFreeSlot } from '../yard/yard.service.js';

const WORK_ORDER_INCLUDE = {
  container: { select: { number: true } },
  targetContainer: { select: { number: true } },
  completedBy: { select: { id: true, name: true } },
};

export function toWorkOrderResponse(workOrder) {
  return {
    id: workOrder.id,
    groupKey: workOrder.groupKey,
    sequence: workOrder.sequence,
    status: workOrder.status,
    reason: workOrder.reason,
    containerNumber: workOrder.container.number,
    targetContainerNumber: workOrder.targetContainer.number,
    fromPosition: workOrder.fromPosition,
    toPosition: workOrder.toPosition,
    completedBy: workOrder.completedBy ?? null,
    completedAt: workOrder.completedAt,
    createdAt: workOrder.createdAt,
  };
}

function sourceAddressOf(position) {
  return {
    blockId: position.blockId,
    blockCode: position.block.code,
    row: position.row,
    bay: position.bay,
  };
}

async function findOpenGroup(transaction, targetContainerId) {
  return transaction.workOrder.findMany({
    where: { targetContainerId, status: 'OPEN' },
    orderBy: { sequence: 'asc' },
    include: WORK_ORDER_INCLUDE,
  });
}

export function waitingForRelocationsMessage(count) {
  return `Waiting for ${count} ${count === 1 ? 'relocation' : 'relocations'}`;
}

export function relocationPending(workOrders) {
  return conflict(
    'RELOCATION_PENDING',
    waitingForRelocationsMessage(workOrders.length),
    workOrders.map(toWorkOrderResponse),
  );
}

export function publishWorkOrderChanges(eventBus, workOrders) {
  for (const workOrder of workOrders) {
    eventBus.publish(WORK_ORDER_CHANGED, {
      id: workOrder.id,
      groupKey: workOrder.groupKey,
      status: workOrder.status,
    });
  }
}

export async function requestRelocations(transaction, { container, reason, actor, auditService }) {
  const openGroup = await findOpenGroup(transaction, container.id);
  if (openGroup.length > 0) {
    return { workOrders: openGroup, created: false };
  }
  const stack = await loadStack(transaction, container.position.block, container.position);
  if (stack.height <= container.position.tier) {
    return null;
  }
  const workOrders = await createRelocationWorkOrders(transaction, {
    targetContainerId: container.id,
    reason,
    actor,
    auditService,
  });
  return { workOrders, created: true };
}

export async function cancelOpenRelocations(transaction, targetContainerId) {
  const openGroup = await findOpenGroup(transaction, targetContainerId);
  if (openGroup.length === 0) {
    return [];
  }
  await transaction.workOrder.updateMany({
    where: { id: { in: openGroup.map((workOrder) => workOrder.id) } },
    data: { status: 'CANCELLED' },
  });
  return openGroup.map((workOrder) => ({ ...workOrder, status: 'CANCELLED' }));
}

export async function createRelocationWorkOrders(
  transaction,
  { targetContainerId, reason, actor, auditService },
) {
  const existing = await findOpenGroup(transaction, targetContainerId);
  if (existing.length > 0) {
    return existing;
  }
  const target = await transaction.container.findUniqueOrThrow({
    where: { id: targetContainerId },
    include: { position: { include: { block: true } } },
  });
  const source = sourceAddressOf(target.position);
  await lockBlocks(transaction, [source.blockId]);
  const sourceStack = await loadStack(transaction, target.position.block, source);
  const blockers = planBlockers({ tier: target.position.tier }, sourceStack.containers);
  if (blockers.length === 0) {
    return [];
  }
  const { blocks, stacks } = await loadYard(transaction);
  const plans = planRelocationDestinations({ blockers, blocks, stacks, sourceStack: source });
  if (plans.some(({ destination }) => destination === null)) {
    throw conflict(
      'NO_FREE_SLOT',
      `No free slot to relocate the containers above ${formatContainerNumber(target.number)}`,
    );
  }
  const groupKey = randomUUID();
  for (const { blocker, destination } of plans) {
    await transaction.workOrder.create({
      data: {
        containerId: blocker.id,
        targetContainerId,
        fromPosition: formatPositionCode({ ...source, tier: blocker.tier }),
        toPosition: destination.positionCode,
        sequence: blocker.sequence,
        groupKey,
        reason,
      },
    });
  }
  const created = await findOpenGroup(transaction, targetContainerId);
  await auditService.record(
    {
      userId: actor.id,
      action: 'CREATE_RELOCATION',
      entity: 'WorkOrder',
      entityId: groupKey,
      after: created.map(toWorkOrderResponse),
      ip: actor.ip,
    },
    transaction,
  );
  return created;
}

export function createWorkOrdersService({ prisma, auditService, eventBus, clock }) {
  async function list(query) {
    return paginate(prisma, prisma.workOrder, {
      where: {
        status: query.status,
        groupKey: query.groupKey,
        ...(query.containerNumber && {
          OR: [
            { container: { number: query.containerNumber } },
            { targetContainer: { number: query.containerNumber } },
          ],
        }),
      },
      include: WORK_ORDER_INCLUDE,
      query,
      present: toWorkOrderResponse,
    });
  }

  async function findOpenWorkOrder(transaction, id) {
    const workOrder = await transaction.workOrder.findUnique({
      where: { id },
      include: { container: { include: { position: { include: { block: true } } } } },
    });
    if (!workOrder) {
      throw notFound('Work order not found');
    }
    if (workOrder.status !== 'OPEN') {
      throw conflict('WORK_ORDER_NOT_OPEN', `Work order ${id} is already ${workOrder.status}`);
    }
    const earlier = await transaction.workOrder.findFirst({
      where: { groupKey: workOrder.groupKey, status: 'OPEN', sequence: { lt: workOrder.sequence } },
      orderBy: { sequence: 'asc' },
    });
    if (earlier) {
      throw conflict(
        'WORK_ORDER_OUT_OF_SEQUENCE',
        `Complete work order ${earlier.sequence} of this group first`,
      );
    }
    if (!workOrder.container.position) {
      throw conflict(
        'CONTAINER_NOT_IN_YARD',
        'The container of this work order is not in the yard',
      );
    }
    return workOrder;
  }

  async function evaluatePlannedDestination(transaction, container, planned, source) {
    if (!planned.block || stackKey(planned.address) === stackKey(source)) {
      return { ...planned, problems: [{ message: 'The planned stack no longer exists' }] };
    }
    const stack = await loadStack(transaction, planned.block, planned.address);
    const problems = stackingProblems({
      container,
      block: planned.block,
      stack,
      tier: planned.address.tier,
    });
    return { block: planned.block, stack, problems };
  }

  async function nextBestDestination(transaction, container, source) {
    const { blocks, stacks } = await loadYard(transaction);
    const [best] = suggestSlots({
      container,
      blocks,
      stacks,
      excludedStacks: new Set([stackKey(source)]),
      limit: 1,
    });
    if (!best) {
      throw noFreeSlot();
    }
    const block = blocks.find((candidate) => candidate.code === best.blockCode);
    return { block, stack: await loadStack(transaction, block, best) };
  }

  async function complete(id, actor) {
    const result = await prisma.$transaction(async (transaction) => {
      const workOrder = await findOpenWorkOrder(transaction, id);
      const { container } = workOrder;
      const source = sourceAddressOf(container.position);
      const plannedAddress = parsePositionCode(workOrder.toPosition);
      const plannedBlock = await transaction.block.findUnique({
        where: { code: plannedAddress.blockCode },
      });
      await lockBlocks(transaction, [source.blockId, ...(plannedBlock ? [plannedBlock.id] : [])]);
      const sourceStack = await loadStack(transaction, container.position.block, source);
      const blockerCount = sourceStack.height - container.position.tier;
      if (blockerCount > 0) {
        throw containerBlocked(blockerCount);
      }
      const planned = await evaluatePlannedDestination(
        transaction,
        container,
        { block: plannedBlock, address: plannedAddress },
        source,
      );
      const isPlanValid = planned.problems.length === 0;
      const destination = isPlanValid
        ? planned
        : await nextBestDestination(transaction, container, source);
      const fromPosition = positionCodeOf(container.position);
      const toPosition = await moveToStackTop(transaction, {
        container,
        block: destination.block,
        stack: destination.stack,
        type: 'RELOCATION',
        userId: actor.id,
        at: clock(),
      });
      const saved = await transaction.workOrder.update({
        where: { id },
        data: { status: 'DONE', completedById: actor.id, completedAt: clock(), toPosition },
        include: WORK_ORDER_INCLUDE,
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'COMPLETE',
          entity: 'WorkOrder',
          entityId: id,
          before: { status: 'OPEN', plannedTo: workOrder.toPosition },
          after: {
            status: 'DONE',
            fromPosition,
            toPosition,
            replanned: !isPlanValid,
            ...(!isPlanValid && { replanReason: planned.problems[0].message }),
          },
          ip: actor.ip,
        },
        transaction,
      );
      return { workOrder: saved, fromPosition, toPosition };
    }, POSITION_WRITE_TRANSACTION);
    const { workOrder, fromPosition, toPosition } = result;
    eventBus.publish(
      YARD_CHANGED,
      yardChanges(workOrder.container.number, fromPosition, toPosition),
    );
    eventBus.publish(WORK_ORDER_CHANGED, {
      id: workOrder.id,
      groupKey: workOrder.groupKey,
      status: workOrder.status,
    });
    return toWorkOrderResponse(workOrder);
  }

  return { list, complete };
}
