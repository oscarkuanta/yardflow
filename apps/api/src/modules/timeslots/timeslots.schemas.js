import { z } from 'zod';

export const MAX_SLOT_CAPACITY = 100;

const dateField = z.iso.date('Use a real date in the format YYYY-MM-DD');

export const listTimeSlotsQuery = z.object({ date: dateField });

export const updateCapacityBody = z
  .object({
    slotId: z.number().int().positive().optional(),
    date: dateField.optional(),
    capacity: z
      .number('Capacity must be a number')
      .int('Capacity must be a whole number')
      .min(0, 'Capacity cannot be negative')
      .max(MAX_SLOT_CAPACITY, `Capacity must be at most ${MAX_SLOT_CAPACITY}`),
  })
  .strict()
  .refine((body) => (body.slotId === undefined) !== (body.date === undefined), {
    message: 'Send either slotId for one slot or date for a whole day, not both',
    path: ['slotId'],
  });
