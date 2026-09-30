import { conflict, validationFailed } from '../../lib/errors.js';
import { VESSEL_CHANGED } from '../../lib/event-bus.js';
import { rethrowUniqueViolation } from '../../lib/prisma-errors.js';
import { duplicateRowProblems, readItemsCsv, validateItemRows } from './vessel-items.js';
import {
  ITEM_INCLUDE,
  attributesOf,
  findVisitOrThrow,
  ownersById,
  toItemResponse,
  vesselProgress,
} from './vessel-queries.js';

function itemAlreadyListed() {
  return conflict('ITEM_ALREADY_LISTED', 'This container is already on that list of this visit');
}

function importFailed(problems) {
  const lineCount = new Set(problems.map((problem) => problem.line)).size;
  const noun = lineCount === 1 ? 'line has' : 'lines have';
  return validationFailed(problems, `${lineCount} ${noun} problems, nothing was imported`);
}

async function findOpenVisit(transaction, visitId) {
  const visit = await findVisitOrThrow(transaction, visitId);
  if (visit.status === 'DEPARTED') {
    throw conflict('VISIT_DEPARTED', 'This visit has departed and can no longer change');
  }
  return visit;
}

async function businessProblems(transaction, visitId, items) {
  const numbers = items.map(({ value }) => value.containerNumber);
  const [companies, existingItems, containers] = await Promise.all([
    transaction.company.findMany({
      where: { code: { in: [...new Set(items.map(({ value }) => value.ownerCode))] } },
    }),
    transaction.vesselVisitItem.findMany({
      where: { visitId, containerNumber: { in: numbers } },
      select: { containerNumber: true, direction: true },
    }),
    transaction.container.findMany({ where: { number: { in: numbers } } }),
  ]);
  const companiesByCode = new Map(companies.map((company) => [company.code, company]));
  const listed = new Set(existingItems.map((item) => `${item.containerNumber}-${item.direction}`));
  const containersByNumber = new Map(containers.map((container) => [container.number, container]));
  const problems = [];
  for (const { line, value } of items) {
    const company = companiesByCode.get(value.ownerCode);
    if (!company) {
      problems.push({
        line,
        field: 'ownerCode',
        message: `Company ${value.ownerCode} does not exist`,
      });
    } else if (!company.isActive) {
      problems.push({
        line,
        field: 'ownerCode',
        message: `Company ${value.ownerCode} is inactive`,
      });
    }
    if (listed.has(`${value.containerNumber}-${value.direction}`)) {
      problems.push({
        line,
        field: 'containerNumber',
        message: `Container is already on the ${value.direction.toLowerCase()} list of this visit`,
      });
    }
    const container = containersByNumber.get(value.containerNumber);
    if (value.direction === 'DISCHARGE' && container?.state === 'IN_YARD') {
      problems.push({
        line,
        field: 'containerNumber',
        message: 'Container is already in the yard',
      });
    }
  }
  return { problems, companiesByCode, containersByNumber };
}

async function expectedContainerFor(transaction, value, ownerCompanyId, existing) {
  const data = { ...attributesOf(value), ownerCompanyId };
  if (!existing) {
    return transaction.container.create({
      data: { number: value.containerNumber, ...data, state: 'EXPECTED' },
    });
  }
  if (existing.state === 'DEPARTED') {
    return transaction.container.update({
      where: { id: existing.id },
      data: { ...data, state: 'EXPECTED', gateInAt: null, departedAt: null },
    });
  }
  return existing;
}

async function insertItems(transaction, visitId, items, lookups) {
  const created = [];
  for (const { value } of items) {
    const ownerCompanyId = lookups.companiesByCode.get(value.ownerCode).id;
    const existing = lookups.containersByNumber.get(value.containerNumber);
    const container =
      value.direction === 'DISCHARGE'
        ? await expectedContainerFor(transaction, value, ownerCompanyId, existing)
        : existing;
    created.push(
      await transaction.vesselVisitItem.create({
        data: {
          visitId,
          containerNumber: value.containerNumber,
          containerId: container?.id ?? null,
          direction: value.direction,
          ...attributesOf(value),
          ownerCompanyId,
        },
        include: ITEM_INCLUDE,
      }),
    );
  }
  return created;
}

export function createVesselItemsService({ prisma, auditService, eventBus }) {
  async function addItem(visitId, value, actor) {
    const { item, progress } = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(async (transaction) => {
          const visit = await findOpenVisit(transaction, visitId);
          const entries = [{ line: null, value }];
          const lookups = await businessProblems(transaction, visitId, entries);
          if (lookups.problems.length > 0) {
            throw validationFailed(
              lookups.problems.map(({ field, message }) => ({ field: `body.${field}`, message })),
            );
          }
          const [created] = await insertItems(transaction, visitId, entries, lookups);
          await auditService.record(
            {
              userId: actor.id,
              action: 'CREATE',
              entity: 'VesselVisitItem',
              entityId: created.id,
              after: { visitId, ...value },
              ip: actor.ip,
            },
            transaction,
          );
          return { item: created, progress: await vesselProgress(transaction, visit) };
        }),
      itemAlreadyListed,
    );
    eventBus.publish(VESSEL_CHANGED, progress);
    return toItemResponse(item, await ownersById(prisma, [item.ownerCompanyId]));
  }

  function checkedCsvItems(csvText) {
    const { rows, problems: fileProblems } = readItemsCsv(csvText);
    if (fileProblems.length > 0) {
      throw importFailed(fileProblems);
    }
    const { items, problems } = validateItemRows(rows);
    const allProblems = [...problems, ...duplicateRowProblems(items)];
    if (allProblems.length > 0) {
      throw importFailed(allProblems.sort((first, second) => first.line - second.line));
    }
    return items;
  }

  async function importItems(visitId, csvText, actor) {
    const items = checkedCsvItems(csvText);
    const { created, progress } = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(
          async (transaction) => {
            const visit = await findOpenVisit(transaction, visitId);
            const lookups = await businessProblems(transaction, visitId, items);
            if (lookups.problems.length > 0) {
              throw importFailed(lookups.problems);
            }
            const inserted = await insertItems(transaction, visitId, items, lookups);
            await auditService.record(
              {
                userId: actor.id,
                action: 'IMPORT_ITEMS',
                entity: 'VesselVisit',
                entityId: visitId,
                after: { imported: inserted.length },
                ip: actor.ip,
              },
              transaction,
            );
            return { created: inserted, progress: await vesselProgress(transaction, visit) };
          },
          { timeout: 60000 },
        ),
      itemAlreadyListed,
    );
    eventBus.publish(VESSEL_CHANGED, progress);
    return {
      imported: created.length,
      discharge: created.filter((item) => item.direction === 'DISCHARGE').length,
      load: created.filter((item) => item.direction === 'LOAD').length,
    };
  }

  return { addItem, importItems };
}
