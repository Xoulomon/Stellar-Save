const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/integrationSetup.ts'],
  collectCoverage: false,
};
