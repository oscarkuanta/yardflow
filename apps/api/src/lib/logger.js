import pino from 'pino';

export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export function createLogger({ logLevel }) {
  return pino({ level: logLevel, redact: REDACTED_PATHS });
}
