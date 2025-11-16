# Contributing to Harmonia

Thank you for your interest in contributing to Harmonia! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by the [OHDSI Code of Conduct](https://ohdsi.org/code-of-conduct/).

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- Basic understanding of TypeScript and federated learning concepts
- Familiarity with OMOP CDM (helpful but not required)

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/Harmonia.git
   cd Harmonia
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/OHDSI/Harmonia.git
   ```

4. **Install dependencies**:

   ```bash
   npm install
   ```

5. **Build all packages**:

   ```bash
   npm run build
   ```

6. **Run tests**:
   ```bash
   npm test
   ```

## Development Workflow

### 1. Create a Feature Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
# or
git checkout -b docs/documentation-update
```

Branch naming conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

### 2. Make Your Changes

- Write clear, commented code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Code Quality Checks

**IMPORTANT: Run this before every commit and push:**

```bash
# Run all quality checks at once (recommended)
npm run validate
```

This runs all checks in sequence:

- Lint (ESLint)
- Format check (Prettier)
- Type check (TypeScript)
- All tests

Or run individual checks:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run typecheck

# Run tests
npm test
```

** All checks must pass before pushing to remote.**

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add .
git commit -m "feat: add differential privacy module

- Implement Gaussian mechanism for DP
- Add privacy budget tracking
- Include comprehensive unit tests
"
```

Commit message format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:

- Clear title describing the change
- Detailed description of what and why
- Reference to related issues (if any)
- Screenshots (if UI changes)

## Testing Guidelines

### Writing Tests

All new features should include tests:

```typescript
// packages/core/src/__tests__/fedavg.test.ts
import { aggregateWeights } from '../horizontal/fedavg';

describe('FedAvg Algorithm', () => {
  it('should aggregate weights correctly', () => {
    const updates = [
      { siteId: 'A', weights: mockWeights1, sampleCount: 100 },
      { siteId: 'B', weights: mockWeights2, sampleCount: 200 },
    ];

    const result = aggregateWeights(updates, {
      minParticipants: 2,
      totalRounds: 10,
      aggregationStrategy: 'weighted',
    });

    expect(result).toBeDefined();
    // Add more assertions
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific package
npm test --workspace=@harmonia/core

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Package Guidelines

### Adding a New Package

1. Create package directory:

   ```bash
   mkdir -p packages/new-package/src
   ```

2. Create `package.json`:

   ```json
   {
     "name": "@harmonia/new-package",
     "version": "0.1.0",
     "description": "Description",
     "main": "dist/index.js",
     "types": "dist/index.d.ts"
   }
   ```

3. Create `tsconfig.json`:

   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     }
   }
   ```

4. Update root `package.json` workspaces if needed

### Package Dependencies

- Use workspace dependencies for internal packages: `"@harmonia/core": "^0.1.0"`
- Pin external dependencies to specific versions
- Keep dependencies minimal

## Security Guidelines

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead, email: security@ohdsi.org

### Secure Coding Practices

- Never commit credentials or secrets
- Validate all user inputs
- Use parameterized queries for database access
- Follow OWASP guidelines for web security
- Keep dependencies updated

## Documentation Guidelines

### Code Documentation

Use JSDoc comments for all public APIs:

````typescript
/**
 * Aggregate client updates using weighted averaging
 *
 * @param updates - Array of client updates to aggregate
 * @param config - Federated averaging configuration
 * @returns Aggregated model weights
 * @throws {Error} If insufficient participants
 *
 * @example
 * ```typescript
 * const aggregated = aggregateWeights(updates, {
 *   minParticipants: 3,
 *   totalRounds: 10,
 *   aggregationStrategy: 'weighted'
 * });
 * ```
 */
export function aggregateWeights(updates: ClientUpdate[], config: FedAvgConfig): SerializedWeights {
  // Implementation
}
````

### README Updates

When adding new features:

- Update relevant README files
- Add examples
- Update API documentation
- Add to changelog

## Bug Reports

### Before Submitting

1. Check existing issues
2. Verify it's reproducible
3. Test on latest version

### Bug Report Template

```markdown
**Describe the bug**
A clear description of the bug.

**To Reproduce**
Steps to reproduce:

1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Environment:**

- OS: [e.g., Ubuntu 22.04]
- Node.js version: [e.g., 18.17.0]
- Harmonia version: [e.g., 0.1.0]

**Additional context**
Any other relevant information.
```

## Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
Clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions considered.

**Additional context**
Any other relevant information.
```

## Good First Issues

Look for issues labeled `good first issue` - these are great starting points for new contributors!

## Community

- **OHDSI Forums**: https://forums.ohdsi.org
- **GitHub Discussions**: For design discussions
- **GitHub Issues**: For bugs and features
- **Email**: harmonia@ohdsi.org

## License

By contributing to Harmonia, you agree that your contributions will be licensed under the Apache License 2.0.

## Recognition

All contributors will be recognized in:

- GitHub contributors page
- CHANGELOG.md
- Project documentation
- Academic publications (for significant contributions)

## Questions?

If you have questions:

1. Check existing documentation
2. Search GitHub issues
3. Ask in OHDSI forums
4. Email: harmonia@ohdsi.org

Thank you for contributing to Harmonia!
