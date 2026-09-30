import { ContainerSize } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';

export const MAX_FREE_DAYS = 365;
export const MAX_DAILY_RATE_CENTS = 1_000_000;

export const updateTariffBody = z
  .object({
    size: z.enum(Object.values(ContainerSize), 'Choose a valid container size'),
    isDangerous: z.boolean('Say whether the tariff is for dangerous goods'),
    freeDays: z
      .number('Free days must be a number')
      .int('Free days must be a whole number')
      .min(0, 'Free days cannot be negative')
      .max(MAX_FREE_DAYS, `Free days must be at most ${MAX_FREE_DAYS}`)
      .optional(),
    dailyRateCents: z
      .number('Daily rate must be a number')
      .int('Daily rate must be whole euro cents')
      .min(0, 'Daily rate cannot be negative')
      .max(MAX_DAILY_RATE_CENTS, `Daily rate must be at most ${MAX_DAILY_RATE_CENTS} cents`)
      .optional(),
  })
  .strict()
  .refine(
    (body) => body.freeDays !== undefined || body.dailyRateCents !== undefined,
    'Send freeDays, dailyRateCents or both',
  );

export const listTariffsQuery = listQuerySchema({
  sortFields: ['id', 'size', 'isDangerous'],
  defaultSort: 'id:asc',
});
