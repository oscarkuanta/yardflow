import { MovementType, containerNumberSchema } from '@yardflow/shared';
import { z } from 'zod';
import { FROM_NOT_AFTER_TO, dateRangeFilters, fromNotAfterTo } from '../../lib/date-range.js';
import { listInvoicesQuery } from '../billing/invoices.schemas.js';
import { listContainersQuery } from '../containers/containers.schemas.js';

const PAGING_FIELDS = { page: true, pageSize: true, sort: true };

export const containersExportQuery = listContainersQuery.omit(PAGING_FIELDS);

export const invoicesExportQuery = listInvoicesQuery.omit(PAGING_FIELDS);

export const movementsExportQuery = z
  .object({
    type: z.enum(Object.values(MovementType)).optional(),
    containerNumber: containerNumberSchema.optional(),
    ...dateRangeFilters,
  })
  .refine(fromNotAfterTo, FROM_NOT_AFTER_TO);
