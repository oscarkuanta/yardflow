import { containerNumberSchema } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { booleanQuery } from '../../lib/schemas.js';

export const placeHoldBody = z
  .object({
    containerNumber: containerNumberSchema,
    reason: z
      .string('Enter the reason for the hold')
      .trim()
      .min(3, 'Enter the reason for the hold')
      .max(200, 'Reason must be at most 200 characters'),
  })
  .strict();

export const listHoldsQuery = listQuerySchema({
  sortFields: ['id', 'placedAt', 'releasedAt'],
  defaultSort: 'placedAt:desc',
  filters: {
    isActive: booleanQuery.optional(),
    containerNumber: containerNumberSchema.optional(),
  },
});
