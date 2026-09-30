import { DamageCode, DamageSide, GateDirection, containerNumberSchema } from '@yardflow/shared';
import { z } from 'zod';
import { GATE_LANES } from '../../config/terminal.js';
import { listQuerySchema } from '../../lib/pagination.js';
import { driverNameField, truckPlateField } from '../preadvices/preadvices.schemas.js';
import { targetPositionField } from '../yard/yard.schemas.js';

export const MAX_DAMAGE_REPORTS = 12;

const laneField = z
  .number('Choose a lane')
  .int()
  .refine((lane) => GATE_LANES.includes(lane), `Lane must be one of ${GATE_LANES.join(', ')}`);

const preAdviceIdField = z.number('Verify the truck first').int().positive();

export const verifyTruckBody = z
  .object({
    truckPlate: truckPlateField,
    pin: z.string('Enter the 6-digit PIN').regex(/^\d{6}$/, 'PIN must be 6 digits'),
    direction: z.enum(Object.values(GateDirection), 'Direction must be IN or OUT'),
  })
  .strict();

const damageReport = z
  .object({
    side: z.enum(Object.values(DamageSide), 'Choose a side of the container'),
    code: z.enum(Object.values(DamageCode), 'Choose a damage code'),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const gateInBody = z
  .object({
    preAdviceId: preAdviceIdField,
    containerNumber: containerNumberSchema,
    lane: laneField,
    noDamage: z.boolean().default(false),
    damages: z.array(damageReport).max(MAX_DAMAGE_REPORTS).default([]),
    to: targetPositionField,
  })
  .strict()
  .refine((body) => body.noDamage !== body.damages.length > 0, {
    message: 'Mark damage on at least one side, or tick No damage, but not both',
    path: ['damages'],
  });

export const gateOutBody = z
  .object({
    preAdviceId: preAdviceIdField,
    truckPlate: truckPlateField,
    driverName: driverNameField,
    lane: laneField,
  })
  .strict();

export const listTransactionsQuery = listQuerySchema({
  sortFields: ['id', 'createdAt'],
  defaultSort: 'createdAt:desc',
  filters: {
    direction: z.enum(Object.values(GateDirection)).optional(),
    date: z.iso.date('Use a real date in the format YYYY-MM-DD').optional(),
    containerNumber: containerNumberSchema.optional(),
  },
});
