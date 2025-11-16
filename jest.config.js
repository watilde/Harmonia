module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@harmonia/core$': '<rootDir>/packages/core/src',
    '^@harmonia/crypto$': '<rootDir>/packages/crypto/src',
    '^@harmonia/omop$': '<rootDir>/packages/omop/src',
    '^@harmonia/client$': '<rootDir>/packages/client/src',
    '^@harmonia/coordinator$': '<rootDir>/packages/coordinator/src',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
