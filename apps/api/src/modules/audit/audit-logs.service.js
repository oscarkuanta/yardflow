import { batchesOf, streamCsv } from '../../lib/csv.js';
import { terminalDayRange } from '../../lib/date-range.js';
import { paginate } from '../../lib/pagination.js';

const AUDIT_INCLUDE = { user: { select: { id: true, name: true, email: true } } };
const CSV_COLUMNS = [
  'id',
  'createdAt',
  'action',
  'entity',
  'entityId',
  'userEmail',
  'ip',
  'before',
  'after',
];

function toAuditLogResponse(entry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    user: entry.user ?? null,
    ip: entry.ip,
    before: entry.before,
    after: entry.after,
  };
}

function jsonOrEmpty(value) {
  return value === null || value === undefined ? '' : JSON.stringify(value);
}

function toCsvRow(entry) {
  return {
    id: entry.id,
    createdAt: entry.createdAt.toISOString(),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    userEmail: entry.user?.email ?? '',
    ip: entry.ip ?? '',
    before: jsonOrEmpty(entry.before),
    after: jsonOrEmpty(entry.after),
  };
}

function buildWhere(query) {
  return {
    userId: query.userId,
    entity: query.entity,
    entityId: query.entityId,
    action: query.action,
    createdAt: terminalDayRange(query),
  };
}

export function createAuditLogsService({ prisma }) {
  async function list(query) {
    return paginate(prisma, prisma.auditLog, {
      where: buildWhere(query),
      include: AUDIT_INCLUDE,
      query,
      present: toAuditLogResponse,
    });
  }

  function exportCsv(response, query) {
    return streamCsv(response, {
      filename: 'audit-logs.csv',
      columns: CSV_COLUMNS,
      batches: batchesOf(prisma.auditLog, { where: buildWhere(query), include: AUDIT_INCLUDE }),
      toRow: toCsvRow,
    });
  }

  return { list, exportCsv };
}
