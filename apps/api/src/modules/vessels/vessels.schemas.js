import {
  ContainerSize,
  LoadStatus,
  VesselVisitStatus,
  VisitDirection,
  containerNumberSchema,
} from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { atLeastOneField, searchQuery } from '../../lib/schemas.js';
import { targetPositionField } from '../yard/yard.schemas.js';

export const MIN_GROSS_WEIGHT_KG = 1000;
export const MAX_GROSS_WEIGHT_KG = 60000;

const dateTimeField = z.iso
  .datetime({
    offset: true,
    message: 'Use an ISO 8601 date and time, for example 2026-10-01T06:00:00Z',
  })
  .transform((value) => new Date(value));

const visitFields = {
  vesselName: z.string('Enter the vessel name').trim().min(1, 'Enter the vessel name').max(100),
  imoNumber: z
    .string('Enter the IMO number')
    .trim()
    .regex(/^\d{7}$/, 'IMO number must be 7 digits'),
  voyage: z.string('Enter the voyage').trim().min(1, 'Enter the voyage').max(10),
  eta: dateTimeField,
  etd: dateTimeField,
};

function etdAfterEta(visit) {
  return !visit.eta || !visit.etd || visit.etd > visit.eta;
}

const ETD_AFTER_ETA = { message: 'ETD must be after ETA', path: ['etd'] };

export const createVisitBody = z.object(visitFields).strict().refine(etdAfterEta, ETD_AFTER_ETA);

export const updateVisitBody = atLeastOneField(
  z
    .object({
      ...visitFields,
      status: z.enum(['ARRIVED', 'DEPARTED'], 'Status can be set to ARRIVED or DEPARTED'),
      departWithOpenItems: z.boolean(),
    })
    .partial()
    .strict(),
).refine(etdAfterEta, ETD_AFTER_ETA);

export const listVisitsQuery = listQuerySchema({
  sortFields: ['id', 'eta', 'etd', 'vesselName', 'createdAt'],
  defaultSort: 'eta:asc',
  filters: {
    status: z.enum(Object.values(VesselVisitStatus)).optional(),
    search: searchQuery.optional(),
  },
});

export const visitItemSchema = z
  .object({
    containerNumber: containerNumberSchema,
    size: z.enum(Object.values(ContainerSize), 'Size must be FT20, FT40 or FT45'),
    isHighCube: z.boolean('isHighCube must be true or false').default(false),
    loadStatus: z.enum(Object.values(LoadStatus), 'Load status must be FULL or EMPTY'),
    isDangerous: z.boolean('isDangerous must be true or false').default(false),
    imoClass: z
      .string()
      .trim()
      .regex(/^[1-9](\.[1-6])?$/, 'IMO class must look like 3 or 2.1')
      .nullable()
      .default(null),
    grossWeightKg: z
      .number('Gross weight must be a whole number of kilograms')
      .int('Gross weight must be a whole number of kilograms')
      .min(MIN_GROSS_WEIGHT_KG, `Gross weight must be at least ${MIN_GROSS_WEIGHT_KG} kg`)
      .max(MAX_GROSS_WEIGHT_KG, `Gross weight must be at most ${MAX_GROSS_WEIGHT_KG} kg`)
      .nullable()
      .default(null),
    ownerCode: z
      .string('Enter the owner company code')
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Owner code must be 3 letters'),
    direction: z.enum(Object.values(VisitDirection), 'Direction must be DISCHARGE or LOAD'),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.isDangerous && item.imoClass === null) {
      context.addIssue({
        code: 'custom',
        path: ['imoClass'],
        message: 'Dangerous goods need an IMO class',
      });
    }
    if (!item.isDangerous && item.imoClass !== null) {
      context.addIssue({
        code: 'custom',
        path: ['imoClass'],
        message: 'Only dangerous goods have an IMO class',
      });
    }
  });

export const visitParams = z.object({ id: z.coerce.number().int().positive() });

export const itemParams = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

export const dischargeBody = z.object({ to: targetPositionField }).strict();
