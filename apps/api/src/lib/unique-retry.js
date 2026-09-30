import { isUniqueViolation } from './prisma-errors.js';

export const UNIQUE_RETRY_ATTEMPTS = 3;

export async function retryOnUniqueViolation(operation, attempts = UNIQUE_RETRY_ATTEMPTS) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= attempts) {
        throw error;
      }
    }
  }
}
