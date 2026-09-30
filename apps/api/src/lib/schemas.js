import { z } from 'zod';

export const idParams = z.object({
  id: z.coerce.number().int().positive('Id must be a positive number'),
});

export const booleanQuery = z
  .enum(['true', 'false'], 'Use true or false')
  .transform((value) => value === 'true');

export const searchQuery = z.string().trim().min(1).max(100);

export const emailField = z
  .string('Enter a valid email address')
  .trim()
  .toLowerCase()
  .max(191)
  .pipe(z.email('Enter a valid email address'));

export const nameField = z.string('Enter a name').trim().min(1, 'Enter a name').max(100);

export function atLeastOneField(schema) {
  return schema.refine(
    (value) => Object.keys(value).length > 0,
    'Send at least one field to change',
  );
}
