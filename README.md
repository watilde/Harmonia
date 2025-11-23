# Harmonia

Federated causal inference for multi-site observational health data.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Features

- **Partial identification** — Manski bounds with optimal federated aggregation
- **Privacy-preserving** — No patient-level data sharing (HIPAA compliant)
- **Multi-site** — Coordinate analysis across distributed OMOP CDM databases
- **Sensitivity analysis** — E-values and robustness quantification

## Install

```bash
npm install
npm run build
```

Requires Node.js ≥18.

## Usage

```bash
# Generate synthetic OMOP data
node packages/cli/dist/index.js causal generate-omop-data --scenario diabetes --output ./data -n 1000

# Run causal analysis
node packages/cli/dist/index.js causal analyze --data ./data --scenario diabetes --output results.json
```

**Programmatic:**

```ts
import { computeATEBounds } from './packages/core/src';

const bounds = computeATEBounds(data, { assumption: 'mtr' });
```

## Packages

```
packages/
  core/        # Causal inference algorithms
  cli/         # Command interface
```

## Development

```bash
npm test             # Run tests
npm run lint         # Lint code
npm run validate     # Full check
```

## License

Apache 2.0
