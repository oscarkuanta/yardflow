import { z } from 'zod';
import { getContainerNumberError, normalizeContainerNumber } from '../iso6346.js';

export const containerNumberSchema = z
  .string('Enter a container number')
  .transform(normalizeContainerNumber)
  .superRefine((number, context) => {
    const error = getContainerNumberError(number);
    if (error) {
      context.addIssue({ code: 'custom', message: error });
    }
  });
