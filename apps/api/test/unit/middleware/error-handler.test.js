import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { conflict } from '../../../src/lib/errors.js';
import { errorHandler } from '../../../src/middleware/error-handler.js';

function appThatThrows(error, log) {
  const app = express();
  app.use((incoming, _response, next) => {
    incoming.log = log;
    next();
  });
  app.get('/boom', () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  test('sends an AppError with its status, code and details', async () => {
    const response = await request(
      appThatThrows(conflict('SLOT_TAKEN', 'Slot was just taken, please pick another')),
    ).get('/boom');
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'SLOT_TAKEN',
        message: 'Slot was just taken, please pick another',
        details: [],
      },
    });
  });

  test('hides unexpected errors behind a 500 and logs them', async () => {
    const log = { error: jest.fn() };
    const response = await request(
      appThatThrows(new Error('database password is hunter2'), log),
    ).get('/boom');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test('does not pass through 5xx errors from other libraries', async () => {
    const libraryError = Object.assign(new Error('internal detail'), {
      status: 502,
      expose: false,
    });
    const response = await request(appThatThrows(libraryError, { error: jest.fn() })).get('/boom');
    expect(response.status).toBe(500);
  });
});
