import { formatPositionCode } from '@yardflow/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';
import { rethrowUniqueViolation } from '../../lib/prisma-errors.js';
import { changesStackingClass, describeOccupancy, positionsOutside } from './block-geometry.js';

function toBlockResponse(block, usedSlots) {
  return { ...block, occupancy: describeOccupancy(block, usedSlots) };
}

function blockCodeTaken() {
  return conflict('BLOCK_CODE_TAKEN', 'A block with this code already exists');
}

export function createBlocksService({ prisma, auditService }) {
  async function usedSlotsByBlock(blockIds) {
    const groups = await prisma.containerPosition.groupBy({
      by: ['blockId'],
      where: { blockId: { in: blockIds } },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.blockId, group._count._all]));
  }

  async function list(query) {
    const page = await paginate(prisma, prisma.block, {
      where: { type: query.type, sizeClass: query.sizeClass },
      query,
      present: (block) => block,
    });
    const usedSlots = await usedSlotsByBlock(page.data.map((block) => block.id));
    return {
      ...page,
      data: page.data.map((block) => toBlockResponse(block, usedSlots.get(block.id) ?? 0)),
    };
  }

  async function create(input, actor) {
    const block = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(async (transaction) => {
          const created = await transaction.block.create({ data: input });
          await auditService.record(
            {
              userId: actor.id,
              action: 'CREATE',
              entity: 'Block',
              entityId: created.id,
              after: created,
              ip: actor.ip,
            },
            transaction,
          );
          return created;
        }),
      blockCodeTaken,
    );
    return toBlockResponse(block, 0);
  }

  function assertChangeKeepsContainers(block, changes, positions) {
    if (positions.length > 0 && changesStackingClass(block, changes)) {
      throw conflict(
        'BLOCK_NOT_EMPTY',
        `Block ${block.code} holds containers, so its type and size class cannot change`,
      );
    }
    const cutPositions = positionsOutside({ ...block, ...changes }, positions);
    if (cutPositions.length > 0) {
      throw conflict(
        'BLOCK_SHRINK_CUTS_STACKS',
        `Block ${block.code} cannot shrink: ${cutPositions.length} containers sit outside the new size`,
        cutPositions.map((position) => ({
          positionCode: formatPositionCode({ blockCode: block.code, ...position }),
        })),
      );
    }
  }

  async function update(id, changes, actor) {
    return prisma.$transaction(async (transaction) => {
      const block = await transaction.block.findUnique({ where: { id } });
      if (!block) {
        throw notFound('Block not found');
      }
      const positions = await transaction.containerPosition.findMany({
        where: { blockId: id },
        select: { row: true, bay: true, tier: true },
      });
      assertChangeKeepsContainers(block, changes, positions);
      const saved = await transaction.block.update({ where: { id }, data: changes });
      await auditService.record(
        {
          userId: actor.id,
          action: 'UPDATE',
          entity: 'Block',
          entityId: id,
          before: block,
          after: saved,
          ip: actor.ip,
        },
        transaction,
      );
      return toBlockResponse(saved, positions.length);
    });
  }

  return { list, create, update };
}
