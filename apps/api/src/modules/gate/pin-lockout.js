import { MINUTE_MS } from '../../lib/terminal-time.js';

export const MAX_WRONG_PINS = 5;
export const WRONG_PIN_WINDOW_MS = 15 * MINUTE_MS;
export const LOCKOUT_MS = 15 * MINUTE_MS;

export function createPinLockout() {
  const stateByPlate = new Map();

  function stateOf(plate) {
    if (!stateByPlate.has(plate)) {
      stateByPlate.set(plate, { failures: [], lockedUntil: 0 });
    }
    return stateByPlate.get(plate);
  }

  function lockedUntil(plate, now) {
    const until = stateByPlate.get(plate)?.lockedUntil ?? 0;
    return until > now.getTime() ? new Date(until) : null;
  }

  function recordFailure(plate, now) {
    const state = stateOf(plate);
    state.failures = state.failures.filter((time) => time > now.getTime() - WRONG_PIN_WINDOW_MS);
    state.failures.push(now.getTime());
    if (state.failures.length >= MAX_WRONG_PINS) {
      state.lockedUntil = now.getTime() + LOCKOUT_MS;
      state.failures = [];
      return 0;
    }
    return MAX_WRONG_PINS - state.failures.length;
  }

  function clear(plate) {
    stateByPlate.delete(plate);
  }

  return { lockedUntil, recordFailure, clear };
}
