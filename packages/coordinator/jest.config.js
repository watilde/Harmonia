module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
  moduleNameMapper: {
    '^@harmonia/coordinator$': '<rootDir>/src',
    '^@harmonia/core$': '<rootDir>/../core/src',
    '^@harmonia/crypto$': '<rootDir>/../crypto/src',
  },
};
