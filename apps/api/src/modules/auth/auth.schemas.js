import { z } from 'zod';

export const MAX_PASSWORD_LENGTH = 128;

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z
    .string('Enter your password')
    .min(1, 'Enter your password')
    .max(MAX_PASSWORD_LENGTH, `Password must be at most ${MAX_PASSWORD_LENGTH} characters`),
});
