import { describe, expect, test } from '@jest/globals';
import { destroySession, regenerateSession, saveSession } from '../../src/lib/session.js';
import { LOGIN_ATTEMPTS_PER_WINDOW, LOGIN_WINDOW_MS } from '../../src/middleware/rate-limit.js';

function requestWhoseSession(method, error) {
  return { session: { [method]: (callback) => callback(error) } };
}

describe('session helpers', () => {
  test.each([
    ['regenerate', regenerateSession],
    ['save', saveSession],
    ['destroy', destroySession],
  ])('%s resolves on success and rejects on error', async (method, helper) => {
    await expect(helper(requestWhoseSession(method, null))).resolves.toBeUndefined();
    await expect(helper(requestWhoseSession(method, new Error('store down')))).rejects.toThrow(
      'store down',
    );
  });
});

describe('login rate limit settings', () => {
  test('allow 10 attempts per 15 minutes as the spec says', () => {
    expect(LOGIN_ATTEMPTS_PER_WINDOW).toBe(10);
    expect(LOGIN_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});
