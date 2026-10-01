import { z } from 'zod';
import { DEFAULT_SLOT_CAPACITY, GATE_SLOT_TOLERANCE_MIN } from './terminal.js';

const MIN_SESSION_SECRET_LENGTH = 16;

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().startsWith('mysql://', 'DATABASE_URL must be a mysql:// URL'),
  SESSION_SECRET: z
    .string()
    .min(
      MIN_SESSION_SECRET_LENGTH,
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    ),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  GATE_SLOT_TOLERANCE_MIN: z.coerce.number().int().min(0).default(GATE_SLOT_TOLERANCE_MIN),
  DEFAULT_SLOT_CAPACITY: z.coerce.number().int().positive().default(DEFAULT_SLOT_CAPACITY),
  HTTPS_ONLY: z.enum(['true', 'false'], 'HTTPS_ONLY must be true or false').optional(),
  DEMO_CLOCK_START: z.iso
    .datetime({ offset: true, message: 'DEMO_CLOCK_START must be an ISO date and time' })
    .optional(),
});

function defaultLogLevel(nodeEnv) {
  return nodeEnv === 'test' ? 'silent' : 'info';
}

export function loadConfig(environment = process.env) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  const values = result.data;
  return {
    nodeEnv: values.NODE_ENV,
    isProduction: values.NODE_ENV === 'production',
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    sessionSecret: values.SESSION_SECRET,
    webOrigin: values.WEB_ORIGIN,
    logLevel: values.LOG_LEVEL ?? defaultLogLevel(values.NODE_ENV),
    gateSlotToleranceMin: values.GATE_SLOT_TOLERANCE_MIN,
    defaultSlotCapacity: values.DEFAULT_SLOT_CAPACITY,
    httpsOnly: values.HTTPS_ONLY ? values.HTTPS_ONLY === 'true' : values.NODE_ENV === 'production',
    clockStart: values.DEMO_CLOCK_START ?? null,
  };
}
