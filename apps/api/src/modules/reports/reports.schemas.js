import { z } from 'zod';

export const MAX_GATE_MOVE_DAYS = 60;
export const DWELL_WEEKS = 8;

export const gateMovesQuery = z.object({
  days: z.coerce
    .number('Days must be a number')
    .int('Days must be a whole number')
    .min(1, 'Days must be at least 1')
    .max(MAX_GATE_MOVE_DAYS, `Days must be at most ${MAX_GATE_MOVE_DAYS}`)
    .default(14),
});
