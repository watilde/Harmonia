/**
 * Jest setup file - mocks for ESM modules
 */

// Mock chalk (ESM module)
jest.mock('chalk', () => ({
  default: {
    blue: { bold: (s: string) => s },
    green: (s: string) => s,
    cyan: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    gray: (s: string) => s,
  },
  blue: { bold: (s: string) => s },
  green: (s: string) => s,
  cyan: (s: string) => s,
  red: (s: string) => s,
  yellow: (s: string) => s,
  gray: (s: string) => s,
}));

// Mock ora (ESM module)
jest.mock('ora', () => ({
  default: () => ({
    start: () => ({
      succeed: jest.fn(),
      fail: jest.fn(),
      text: '',
    }),
    succeed: jest.fn(),
    fail: jest.fn(),
  }),
}));

// Mock inquirer
jest.mock('inquirer', () => ({
  default: {
    prompt: jest.fn(),
  },
}));
