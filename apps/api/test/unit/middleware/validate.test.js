import { describe, expect, jest, test } from '@jest/globals';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validate.js';

function run(middleware, incoming) {
  const next = jest.fn();
  middleware(incoming, {}, next);
  return next;
}

describe('validate', () => {
  const middleware = validate({
    body: z.object({ name: z.string().trim().min(1) }),
    query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
    params: z.object({ id: z.coerce.number().int() }),
  });

  test('stores the parsed values on request.validated', () => {
    const incoming = { body: { name: '  Anna ', extra: true }, query: {}, params: { id: '7' } };
    const next = run(middleware, incoming);
    expect(next).toHaveBeenCalledWith();
    expect(incoming.validated).toEqual({
      body: { name: 'Anna' },
      query: { page: 1 },
      params: { id: 7 },
    });
  });

  test('collects every problem with the field path', () => {
    const next = run(middleware, { body: { name: '' }, query: { page: '0' }, params: { id: 'x' } });
    const error = next.mock.calls[0][0];
    expect(error.status).toBe(422);
    expect(error.details.map((detail) => detail.field)).toEqual([
      'body.name',
      'query.page',
      'params.id',
    ]);
  });

  test('treats a missing body as an empty object', () => {
    const next = run(validate({ body: z.object({ name: z.string() }) }), {});
    expect(next.mock.calls[0][0].details[0].field).toBe('body.name');
  });
});
