import { formatContainerNumber } from '@yardflow/shared';
import { notFound } from '../../lib/errors.js';
import { positionCodeOf } from '../yard/placement.js';

export const CONTAINER_ATTRIBUTES = [
  'size',
  'isHighCube',
  'loadStatus',
  'isDangerous',
  'imoClass',
  'grossWeightKg',
];

export const ITEM_INCLUDE = {
  container: {
    select: {
      state: true,
      position: { include: { block: { select: { code: true } } } },
      holds: { where: { releasedAt: null }, select: { id: true } },
    },
  },
};

export function attributesOf(source) {
  return Object.fromEntries(CONTAINER_ATTRIBUTES.map((field) => [field, source[field]]));
}

export async function findVisitOrThrow(client, id) {
  const visit = await client.vesselVisit.findUnique({ where: { id } });
  if (!visit) {
    throw notFound('Vessel visit not found');
  }
  return visit;
}

function emptyCounts() {
  return { discharge: { total: 0, done: 0 }, load: { total: 0, done: 0 } };
}

export async function visitCounts(client, visitIds) {
  const groups = await client.vesselVisitItem.groupBy({
    by: ['visitId', 'direction', 'status'],
    where: { visitId: { in: visitIds } },
    _count: { _all: true },
  });
  const countsByVisit = new Map(visitIds.map((visitId) => [visitId, emptyCounts()]));
  for (const group of groups) {
    const counts = countsByVisit.get(group.visitId)[group.direction.toLowerCase()];
    counts.total += group._count._all;
    if (group.status === 'DONE') {
      counts.done += group._count._all;
    }
  }
  return countsByVisit;
}

export function toVisitResponse(visit, counts = emptyCounts()) {
  const totalCount = counts.discharge.total + counts.load.total;
  const doneCount = counts.discharge.done + counts.load.done;
  return {
    id: visit.id,
    vesselName: visit.vesselName,
    imoNumber: visit.imoNumber,
    voyage: visit.voyage,
    eta: visit.eta,
    etd: visit.etd,
    ata: visit.ata,
    atd: visit.atd,
    status: visit.status,
    createdAt: visit.createdAt,
    discharge: counts.discharge,
    load: counts.load,
    progressPercent: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
  };
}

export async function vesselProgress(client, visit) {
  const counts = (await visitCounts(client, [visit.id])).get(visit.id);
  return {
    visitId: visit.id,
    status: visit.status,
    doneCount: counts.discharge.done + counts.load.done,
    totalCount: counts.discharge.total + counts.load.total,
  };
}

export async function ownersById(client, companyIds) {
  const companies = await client.company.findMany({
    where: { id: { in: [...new Set(companyIds)] } },
    select: { id: true, code: true, name: true },
  });
  return new Map(companies.map((company) => [company.id, company]));
}

export function toItemResponse(item, owners) {
  const position = item.container?.position;
  return {
    id: item.id,
    visitId: item.visitId,
    containerNumber: item.containerNumber,
    displayNumber: formatContainerNumber(item.containerNumber),
    direction: item.direction,
    ...attributesOf(item),
    owner: owners.get(item.ownerCompanyId) ?? null,
    status: item.status,
    doneAt: item.doneAt,
    containerState: item.container?.state ?? null,
    positionCode: position ? positionCodeOf(position) : null,
    hasHold: (item.container?.holds.length ?? 0) > 0,
  };
}
