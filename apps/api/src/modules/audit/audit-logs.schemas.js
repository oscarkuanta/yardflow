import { z } from 'zod';
import { FROM_NOT_AFTER_TO, dateRangeFilters, fromNotAfterTo } from '../../lib/date-range.js';
import { listQuerySchema } from '../../lib/pagination.js';

const auditFilters = {
  userId: z.coerce.number().int().positive().optional(),
  entity: z.string().trim().min(1).max(50).optional(),
  entityId: z.string().trim().min(1).max(100).optional(),
  action: z.string().trim().toUpperCase().min(1).max(50).optional(),
  ...dateRangeFilters,
};

export const listAuditLogsQuery = listQuerySchema({
  sortFields: ['id', 'createdAt'],
  defaultSort: 'createdAt:desc',
  filters: auditFilters,
}).refine(fromNotAfterTo, FROM_NOT_AFTER_TO);

export const exportAuditLogsQuery = z
  .object(auditFilters)
  .refine(fromNotAfterTo, FROM_NOT_AFTER_TO);
