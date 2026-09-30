import { conflict, validationFailed } from '../../lib/errors.js';
import { VESSEL_CHANGED } from '../../lib/event-bus.js';
import { paginate } from '../../lib/pagination.js';
import { statusChangeProblem } from './vessel-status.js';
import {
  ITEM_INCLUDE,
  findVisitOrThrow,
  ownersById,
  toItemResponse,
  toVisitResponse,
  vesselProgress,
  visitCounts,
} from './vessel-queries.js';

function buildWhere({ status, search }) {
  return {
    status,
    ...(search && { OR: [{ vesselName: { contains: search } }, { voyage: { contains: search } }] }),
  };
}

function assertEtdAfterEta(visit, changes) {
  const eta = changes.eta ?? visit.eta;
  const etd = changes.etd ?? visit.etd;
  if (etd <= eta) {
    throw validationFailed([{ field: 'body.etd', message: 'ETD must be after ETA' }]);
  }
}

export function createVesselsService({ prisma, auditService, eventBus, clock }) {
  async function list(query) {
    const page = await paginate(prisma, prisma.vesselVisit, {
      where: buildWhere(query),
      query,
      present: (visit) => visit,
    });
    const counts = await visitCounts(
      prisma,
      page.data.map((visit) => visit.id),
    );
    return {
      ...page,
      data: page.data.map((visit) => toVisitResponse(visit, counts.get(visit.id))),
    };
  }

  async function detail(id) {
    const visit = await findVisitOrThrow(prisma, id);
    const [counts, items] = await Promise.all([
      visitCounts(prisma, [id]),
      prisma.vesselVisitItem.findMany({
        where: { visitId: id },
        orderBy: [{ direction: 'asc' }, { status: 'asc' }, { containerNumber: 'asc' }],
        include: ITEM_INCLUDE,
      }),
    ]);
    const owners = await ownersById(
      prisma,
      items.map((item) => item.ownerCompanyId),
    );
    return {
      ...toVisitResponse(visit, counts.get(id)),
      items: items.map((item) => toItemResponse(item, owners)),
    };
  }

  async function create(input, actor) {
    const visit = await prisma.$transaction(async (transaction) => {
      const created = await transaction.vesselVisit.create({ data: input });
      await auditService.record(
        {
          userId: actor.id,
          action: 'CREATE',
          entity: 'VesselVisit',
          entityId: created.id,
          after: created,
          ip: actor.ip,
        },
        transaction,
      );
      return created;
    });
    return toVisitResponse(visit);
  }

  function statusFields(status, now) {
    if (status === 'ARRIVED') {
      return { status, ata: now };
    }
    if (status === 'DEPARTED') {
      return { status, atd: now };
    }
    return {};
  }

  async function assertStatusChange(transaction, visit, { status, departWithOpenItems }) {
    if (departWithOpenItems !== undefined && status !== 'DEPARTED') {
      throw validationFailed([
        {
          field: 'body.departWithOpenItems',
          message: 'departWithOpenItems only goes with status DEPARTED',
        },
      ]);
    }
    if (status === undefined) {
      return 0;
    }
    const pendingLoadCount = await transaction.vesselVisitItem.count({
      where: { visitId: visit.id, direction: 'LOAD', status: 'PENDING' },
    });
    const problem = statusChangeProblem({
      from: visit.status,
      to: status,
      pendingLoadCount,
      departWithOpenItems: departWithOpenItems === true,
    });
    if (problem) {
      throw conflict(problem.code, problem.message, [{ pendingLoadCount }]);
    }
    return pendingLoadCount;
  }

  async function update(id, { status, departWithOpenItems, ...fields }, actor) {
    const { visit, progress } = await prisma.$transaction(async (transaction) => {
      const existing = await findVisitOrThrow(transaction, id);
      if (existing.status === 'DEPARTED') {
        throw conflict('VISIT_DEPARTED', 'This visit has departed and can no longer change');
      }
      assertEtdAfterEta(existing, fields);
      const pendingLoadCount = await assertStatusChange(transaction, existing, {
        status,
        departWithOpenItems,
      });
      const saved = await transaction.vesselVisit.update({
        where: { id },
        data: { ...fields, ...statusFields(status, clock()) },
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'UPDATE',
          entity: 'VesselVisit',
          entityId: id,
          before: existing,
          after: saved,
          ip: actor.ip,
        },
        transaction,
      );
      if (status === 'DEPARTED' && pendingLoadCount > 0) {
        await auditService.record(
          {
            userId: actor.id,
            action: 'DEPART_WITH_OPEN_ITEMS',
            entity: 'VesselVisit',
            entityId: id,
            after: { pendingLoadCount },
            ip: actor.ip,
          },
          transaction,
        );
      }
      return { visit: saved, progress: await vesselProgress(transaction, saved) };
    });
    if (status) {
      eventBus.publish(VESSEL_CHANGED, progress);
    }
    const counts = await visitCounts(prisma, [id]);
    return toVisitResponse(visit, counts.get(id));
  }

  return { list, detail, create, update };
}
