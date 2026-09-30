import { BlockSizeClass, BlockType } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import { atLeastOneField } from '../../lib/schemas.js';

export const MAX_ROWS_OR_BAYS = 99;
export const MAX_TIER = 9;
export const MAX_MAP_COORDINATE = 5000;

function wholeNumber(label, minimum, maximum) {
  return z
    .number(`${label} must be a number`)
    .int(`${label} must be a whole number`)
    .min(minimum, `${label} must be at least ${minimum}`)
    .max(maximum, `${label} must be at most ${maximum}`);
}

const typeField = z.enum(Object.values(BlockType), 'Choose a valid block type');
const sizeClassField = z.enum(Object.values(BlockSizeClass), 'Choose a valid size class');

const geometryFields = {
  type: typeField,
  sizeClass: sizeClassField,
  rows: wholeNumber('Rows', 1, MAX_ROWS_OR_BAYS),
  bays: wholeNumber('Bays', 1, MAX_ROWS_OR_BAYS),
  maxTier: wholeNumber('Maximum tier', 1, MAX_TIER),
  mapX: wholeNumber('Map X', 0, MAX_MAP_COORDINATE),
  mapY: wholeNumber('Map Y', 0, MAX_MAP_COORDINATE),
  gateDistanceM: wholeNumber('Gate distance', 0, MAX_MAP_COORDINATE),
};

export const createBlockBody = z
  .object({
    code: z
      .string('Enter a block code')
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z][A-Z0-9]?$/,
        'Block code must be 1 or 2 letters or digits, starting with a letter',
      ),
    ...geometryFields,
  })
  .strict();

export const updateBlockBody = atLeastOneField(z.object(geometryFields).partial().strict());

export const listBlocksQuery = listQuerySchema({
  sortFields: ['id', 'code', 'gateDistanceM'],
  defaultSort: 'code:asc',
  filters: { type: typeField.optional(), sizeClass: sizeClassField.optional() },
});
