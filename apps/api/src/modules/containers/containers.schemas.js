import {
  ContainerSize,
  ContainerState,
  LoadStatus,
  containerNumberSchema,
  normalizeContainerNumber,
} from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { booleanQuery } from '../../lib/schemas.js';

export const listContainersQuery = listQuerySchema({
  sortFields: ['number', 'gateInAt', 'createdAt', 'departedAt'],
  defaultSort: 'number:asc',
  filters: {
    search: z
      .string()
      .transform(normalizeContainerNumber)
      .pipe(z.string().min(1, 'Enter part of a container number').max(11))
      .optional(),
    state: z.enum(Object.values(ContainerState)).optional(),
    size: z.enum(Object.values(ContainerSize)).optional(),
    loadStatus: z.enum(Object.values(LoadStatus)).optional(),
    isDangerous: booleanQuery.optional(),
    hasHold: booleanQuery.optional(),
    ownerCode: z.string().trim().toUpperCase().length(3).optional(),
    blockCode: z.string().trim().toUpperCase().max(2).optional(),
  },
});

export const containerNumberParams = z.object({ number: containerNumberSchema });
