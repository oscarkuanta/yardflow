import { rateLimit } from 'express-rate-limit';
import { tooManyRequests } from '../lib/errors.js';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_ATTEMPTS_PER_WINDOW = 10;

export function createRateLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, _response, next) => next(tooManyRequests(message)),
  });
}

export function createLoginRateLimiter({ limit = LOGIN_ATTEMPTS_PER_WINDOW } = {}) {
  return createRateLimiter({
    windowMs: LOGIN_WINDOW_MS,
    limit,
    message: 'Too many login attempts, please try again in 15 minutes',
    skipSuccessfulRequests: true,
  });
}
