import { describe, expect, test } from '@jest/globals';
import { loadConfig } from '../../src/config/env.js';

const MINIMAL_ENVIRONMENT = {
  DATABASE_URL: 'mysql://user:secret@localhost:3306/yardflow',
  SESSION_SECRET: 'a-secret-that-is-long-enough',
};

describe('loadConfig', () => {
  test('fills in safe defaults for local development', () => {
    expect(loadConfig(MINIMAL_ENVIRONMENT)).toEqual({
      nodeEnv: 'development',
      isProduction: false,
      port: 4000,
      databaseUrl: MINIMAL_ENVIRONMENT.DATABASE_URL,
      sessionSecret: MINIMAL_ENVIRONMENT.SESSION_SECRET,
      webOrigin: 'http://localhost:5173',
      logLevel: 'info',
      gateSlotToleranceMin: 30,
      defaultSlotCapacity: 10,
    });
  });

  test('turns numeric strings into numbers', () => {
    const config = loadConfig({
      ...MINIMAL_ENVIRONMENT,
      PORT: '8080',
      GATE_SLOT_TOLERANCE_MIN: '15',
      DEFAULT_SLOT_CAPACITY: '12',
    });
    expect(config).toMatchObject({ port: 8080, gateSlotToleranceMin: 15, defaultSlotCapacity: 12 });
  });

  test('is silent in tests and marks production', () => {
    expect(loadConfig({ ...MINIMAL_ENVIRONMENT, NODE_ENV: 'test' }).logLevel).toBe('silent');
    expect(loadConfig({ ...MINIMAL_ENVIRONMENT, NODE_ENV: 'production' }).isProduction).toBe(true);
  });

  test('uses an explicit log level', () => {
    expect(loadConfig({ ...MINIMAL_ENVIRONMENT, LOG_LEVEL: 'debug' }).logLevel).toBe('debug');
  });

  test('refuses a short session secret and names the problem', () => {
    expect(() => loadConfig({ ...MINIMAL_ENVIRONMENT, SESSION_SECRET: 'short' })).toThrow(
      'SESSION_SECRET: SESSION_SECRET must be at least 16 characters',
    );
  });

  test('refuses a missing or non-MySQL database URL', () => {
    expect(() => loadConfig({ SESSION_SECRET: MINIMAL_ENVIRONMENT.SESSION_SECRET })).toThrow(
      'DATABASE_URL',
    );
    expect(() =>
      loadConfig({ ...MINIMAL_ENVIRONMENT, DATABASE_URL: 'postgres://localhost/yardflow' }),
    ).toThrow('DATABASE_URL must be a mysql:// URL');
  });
});
