import { NotificationType } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { booleanQuery } from '../../lib/schemas.js';

export const listNotificationsQuery = listQuerySchema({
  sortFields: ['id', 'createdAt'],
  defaultSort: 'createdAt:desc',
  filters: {
    unread: booleanQuery.optional(),
    type: z.enum(Object.values(NotificationType)).optional(),
  },
});
