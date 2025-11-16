module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  moduleNameMapper: {
    '^@harmonia/omop$': '<rootDir>/src',
  },
  // Skip integration tests that require database connectivity
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/.*\\.test\\.ts$', // Skip all test files in __tests__ directories
  ],
};
