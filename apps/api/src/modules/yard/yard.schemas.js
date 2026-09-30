import {
  ContainerSize,
  LoadStatus,
  containerNumberSchema,
  parsePositionCode,
} from '@yardflow/shared';
import { z } from 'zod';

export const stackParams = z.object({
  block: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]?$/, 'Block code must be 1 or 2 letters or digits'),
  row: z.coerce.number().int().min(1, 'Row must be at least 1'),
  bay: z.coerce.number().int().min(1, 'Bay must be at least 1'),
});

export const suggestionsBody = z
  .object({
    size: z.enum(Object.values(ContainerSize), 'Choose a valid container size'),
    loadStatus: z.enum(Object.values(LoadStatus), 'Choose FULL or EMPTY'),
    isDangerous: z.boolean().default(false),
    ownerCompanyId: z.number().int().positive().nullable().default(null),
  })
  .strict();

export const moveBody = z
  .object({
    containerNumber: containerNumberSchema,
    to: z
      .string('Enter a target like B-02-05 or B-02-05-2')
      .transform(parsePositionCode)
      .refine(
        (position) => position !== null,
        'Use a stack like B-02-05 or a position like B-02-05-2',
      ),
  })
  .strict();
