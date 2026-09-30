import { describe, expect, test } from '@jest/globals';
import {
  AppError,
  conflict,
  forbidden,
  invalidCredentials,
  malformedRequest,
  notAuthenticated,
  notFound,
  tooManyRequests,
  validationFailed,
} from '../../src/lib/errors.js';

describe('error helpers', () => {
  test.each([
    ['malformedRequest', malformedRequest(), 400, 'MALFORMED_REQUEST'],
    ['notAuthenticated', notAuthenticated(), 401, 'NOT_AUTHENTICATED'],
    ['invalidCredentials', invalidCredentials(), 401, 'INVALID_CREDENTIALS'],
    ['forbidden', forbidden(), 403, 'FORBIDDEN'],
    ['notFound', notFound(), 404, 'NOT_FOUND'],
    [
      'conflict',
      conflict('SLOT_TAKEN', 'Slot was just taken, please pick another'),
      409,
      'SLOT_TAKEN',
    ],
    ['validationFailed', validationFailed([]), 422, 'VALIDATION_FAILED'],
    ['tooManyRequests', tooManyRequests(), 429, 'RATE_LIMITED'],
  ])('%s has status %i and code %s', (_name, error, status, code) => {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(Array.isArray(error.details)).toBe(true);
  });

  test('keeps the details of a validation error', () => {
    const details = [{ field: 'body.email', message: 'Required' }];
    expect(validationFailed(details).details).toBe(details);
  });
});
