import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import {
  atLeastOneField,
  booleanQuery,
  emailField,
  nameField,
  searchQuery,
} from '../../lib/schemas.js';

const codeField = z
  .string('Enter a company code')
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Company code must be exactly 3 letters');

export const createCompanyBody = z
  .object({ code: codeField, name: nameField, contactEmail: emailField })
  .strict();

export const updateCompanyBody = atLeastOneField(
  z.object({ name: nameField, contactEmail: emailField, isActive: z.boolean() }).partial().strict(),
);

export const listCompaniesQuery = listQuerySchema({
  sortFields: ['id', 'code', 'name', 'createdAt'],
  defaultSort: 'name:asc',
  filters: { isActive: booleanQuery.optional(), search: searchQuery.optional() },
});
