# Harmonia

**Federated Partial Identification for Causal Inference with OMOP CDM**

Privacy-preserving multi-site causal inference using Manski bounds. No patient data sharing, honest uncertainty quantification.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## What is This?

Multi-site causal inference without sharing patient data. Sites compute bounds locally, coordinator aggregates results.

**Example**: Does Drug A reduce mortality?

- 3 hospitals want to answer this
- Can't share data (HIPAA/GDPR)
- Each computes bounds: Site A: [-0.1, 0.3], Site B: [0.0, 0.4], Site C: [-0.05, 0.35]
- Aggregated: [-0.05, 0.35] → Honest answer: "Effect uncertain, between -5% and +35%"

**Key Features:**

- ✅ Privacy-preserving (only 3 numbers shared per site: lower bound, upper bound, N)
- ✅ Honest uncertainty (bounds instead of biased point estimates)
- ✅ Minimal assumptions (shape restrictions, not untestable confounding assumptions)
- ✅ OMOP CDM native (standardized EHR data)

## Quick Start

```bash
git clone https://github.com/watilde/Harmonia.git
cd Harmonia

# Install dependencies
npm install

# Build packages
npm run build
```

## Project Structure

```
├── packages/
│   ├── core/          # Manski bounds algorithms
│   ├── cli/           # Command-line interface
│   └── omop/          # OMOP CDM connectors
│
└── research/          # Research experiments & paper
    ├── paper/         # Research manuscript (v6.0)
    ├── scripts/       # Data download, processing, validation
    └── experiments/   # Validation experiments
```

## Usage

### CLI

```bash
# Generate synthetic OMOP data
npx harmonia causal generate-omop-data \
  --scenario diabetes \
  --output ./omop-data/ \
  -n 1000

# Compute causal bounds
npx harmonia causal analyze \
  --data ./omop-data/ \
  --scenario diabetes \
  --output results.json
```

### Programmatic

```typescript
import { computeATEBounds } from '@harmonia/core';

const data = [
  { treatment: 1, outcome: 1 },
  { treatment: 0, outcome: 0 },
  // ...
];

// Worst-case bounds (no assumptions)
const worstCase = computeATEBounds(data, { assumption: 'worst-case' });
console.log(worstCase); // { lower: -0.5, upper: 0.8, width: 1.3 }

// MTR bounds (monotone treatment response)
const mtr = computeATEBounds(data, { assumption: 'mtr' });
console.log(mtr); // { lower: 0.0, upper: 0.8, width: 0.8 }
```

## Research

See **[research/paper/manuscript_v6.0.md](research/paper/manuscript_v6.0.md)** for the full research manuscript.

**Key Results** (Synthea synthetic data, 1k-2.8M patients):

- ✅ Linear scalability: O(N) bounds computation
- ✅ 617ms for 2.8M patients (standard laptop)
- ✅ Privacy-preserving: Only 3 numbers shared per site

**Validation**:

- Monte Carlo simulation (1,000 iterations, 100% coverage)
- OMOP demonstrations: ICU vasopressor, diabetes, cancer screening
- Scalability validation: 1k → 100k → 2.8M patients

## Documentation

- **README.md** (this file) - Project overview
- **[research/README.md](research/README.md)** - Research documentation
- **[research/paper/](research/paper/)** - Research manuscript

## Development

```bash
# Run tests
npm test

# Build all packages
npm run build

# Lint & format
npm run lint
npm run format
```

## Technology Stack

- **Language**: TypeScript/Node.js
- **Data**: OMOP CDM v5 (CSV format)
- **Algorithms**: Manski bounds (worst-case, MTR, MTS, MTR+MTS)
- **Data source**: Synthea synthetic EHR data (AWS S3)

## License

Apache License 2.0 - see [LICENSE](LICENSE)

## Citation

```bibtex
@article{harmonia2025,
  title={Federated Partial Identification for Multi-site Causal Inference Using Synthetic EHR Data},
  author={Wachi, Daijiro},
  year={2025},
  note={Available at: https://github.com/watilde/Harmonia}
}
```

---

_Privacy-preserving causal inference for multi-site observational studies with OMOP CDM._
