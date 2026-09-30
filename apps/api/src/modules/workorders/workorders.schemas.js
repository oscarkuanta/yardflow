import { WorkOrderStatus, containerNumberSchema } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const listWorkOrdersQuery = listQuerySchema({
  sortFields: ['id', 'createdAt', 'completedAt'],
  defaultSort: 'id:asc',
  filters: {
    status: z.enum(Object.values(WorkOrderStatus), 'Choose OPEN, DONE or CANCELLED').optional(),
    groupKey: z.uuid('groupKey must be a UUID').optional(),
    containerNumber: containerNumberSchema.optional(),
  },
});
