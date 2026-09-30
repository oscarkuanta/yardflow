import { Role } from '@yardflow/shared';
import { z } from 'zod';
import { listQuerySchema } from '../../lib/pagination.js';
import {
  atLeastOneField,
  booleanQuery,
  emailField,
  nameField,
  searchQuery,
} from '../../lib/schemas.js';

export const MIN_PASSWORD_LENGTH = 8;

const passwordField = z
  .string('Enter a password')
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, 'Password must be at most 128 characters');
const roleField = z.enum(Object.values(Role), 'Choose a valid role');
const companyIdField = z.number().int().positive().nullable();

export const createUserBody = z
  .object({
    email: emailField,
    name: nameField,
    password: passwordField,
    role: roleField,
    companyId: companyIdField.default(null),
  })
  .strict();

export const updateUserBody = atLeastOneField(
  z
    .object({
      email: emailField,
      name: nameField,
      password: passwordField,
      role: roleField,
      companyId: companyIdField,
      isActive: z.boolean(),
    })
    .partial()
    .strict(),
);

export const listUsersQuery = listQuerySchema({
  sortFields: ['id', 'name', 'email', 'role', 'createdAt', 'lastLoginAt'],
  defaultSort: 'name:asc',
  filters: {
    role: roleField.optional(),
    companyId: z.coerce.number().int().positive().optional(),
    isActive: booleanQuery.optional(),
    search: searchQuery.optional(),
  },
});
