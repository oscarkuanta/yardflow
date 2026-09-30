import { ContainerSize, LoadStatus } from '@yardflow/shared';
import { z } from 'zod';

export const MIN_GROSS_WEIGHT_KG = 1000;
export const MAX_GROSS_WEIGHT_KG = 60000;

export const sizeField = z.enum(Object.values(ContainerSize), 'Size must be FT20, FT40 or FT45');

export const loadStatusField = z.enum(
  Object.values(LoadStatus),
  'Load status must be FULL or EMPTY',
);

export const imoClassField = z
  .string()
  .trim()
  .regex(/^[1-9](\.[1-6])?$/, 'IMO class must look like 3 or 2.1')
  .nullable()
  .default(null);

export const grossWeightField = z
  .number('Gross weight must be a whole number of kilograms')
  .int('Gross weight must be a whole number of kilograms')
  .min(MIN_GROSS_WEIGHT_KG, `Gross weight must be at least ${MIN_GROSS_WEIGHT_KG} kg`)
  .max(MAX_GROSS_WEIGHT_KG, `Gross weight must be at most ${MAX_GROSS_WEIGHT_KG} kg`);

export function checkImoClass(cargo, context) {
  if (cargo.isDangerous && cargo.imoClass === null) {
    context.addIssue({
      code: 'custom',
      path: ['imoClass'],
      message: 'Dangerous goods need an IMO class',
    });
  }
  if (!cargo.isDangerous && cargo.imoClass !== null) {
    context.addIssue({
      code: 'custom',
      path: ['imoClass'],
      message: 'Only dangerous goods have an IMO class',
    });
  }
}
