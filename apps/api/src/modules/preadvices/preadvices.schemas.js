import {
  PreAdviceStatus,
  PreAdviceType,
  containerNumberSchema,
  normalizeTruckPlate,
} from '@yardflow/shared';
import { z } from 'zod';
import {
  checkImoClass,
  grossWeightField,
  imoClassField,
  loadStatusField,
  sizeField,
} from '../../lib/cargo-fields.js';
import { listQuerySchema } from '../../lib/pagination.js';

export const truckPlateField = z
  .string('Enter the truck plate')
  .transform(normalizeTruckPlate)
  .pipe(
    z
      .string()
      .min(2, 'Enter the truck plate')
      .max(15, 'Truck plate must be at most 15 characters')
      .regex(/^[A-Z0-9 -]+$/, 'Truck plate may only contain letters, digits, spaces and dashes'),
  );

export const driverNameField = z
  .string('Enter the driver name')
  .trim()
  .min(2, 'Enter the driver name')
  .max(100, 'Driver name must be at most 100 characters');

const bookingFields = {
  timeSlotId: z.number('Choose a time slot').int().positive(),
  containerNumber: containerNumberSchema,
  truckPlate: truckPlateField,
  driverName: driverNameField,
};

const pickupBody = z.object({ type: z.literal('PICKUP'), ...bookingFields }).strict();

const deliveryBody = z
  .object({
    type: z.literal('DELIVERY'),
    ...bookingFields,
    size: sizeField,
    isHighCube: z.boolean('isHighCube must be true or false'),
    loadStatus: loadStatusField,
    isDangerous: z.boolean('isDangerous must be true or false'),
    imoClass: imoClassField,
    grossWeightKg: grossWeightField,
  })
  .strict()
  .superRefine(checkImoClass);

export const createPreAdviceBody = z.discriminatedUnion('type', [pickupBody, deliveryBody], {
  error: 'Type must be DELIVERY or PICKUP',
});

export const listPreAdvicesQuery = listQuerySchema({
  sortFields: ['id', 'createdAt'],
  defaultSort: 'createdAt:desc',
  filters: {
    status: z.enum(Object.values(PreAdviceStatus)).optional(),
    type: z.enum(Object.values(PreAdviceType)).optional(),
    date: z.iso.date('Use a real date in the format YYYY-MM-DD').optional(),
    search: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .transform((value) => value.toUpperCase())
      .optional(),
  },
});
