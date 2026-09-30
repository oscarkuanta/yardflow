export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/test/**/*.test.js'],
  globalSetup: '<rootDir>/test/helpers/global-setup.js',
  setupFiles: ['<rootDir>/test/helpers/setup-env.js'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.js',
    '<rootDir>/prisma/**/*.js',
    '!<rootDir>/prisma/seed.js',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  testTimeout: 60000,
};
