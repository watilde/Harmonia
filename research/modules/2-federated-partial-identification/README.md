# Federated Partial Identification Module

This module implements **Federated Partial Identification** techniques for causal inference in distributed, privacy-preserving settings. It focuses on computing bounds (rather than point estimates) when standard identifying assumptions cannot be verified.

## Overview

Partial identification provides **valid inference under weaker assumptions** than point identification. When treatment effects cannot be precisely estimated due to:
- Unmeasured confounding
- Selection bias
- Positivity violations
- Instrument imperfections

...we can still compute **bounds** on causal effects that contain the true parameter with high probability.

## Research Focus

This module implements and evaluates:

### 1. **Balke-Pearl Bounds**
- Instrumental variable (IV) based bounds
- Assumes monotonicity but allows unmeasured confounding
- Computes sharp bounds on Average Treatment Effect (ATE) via linear programming

### 2. **Manski Bounds**
- Worst-case bounds under minimal assumptions
- No-Assumptions bounds: widest possible
- Monotone Treatment Response (MTR): tighter bounds
- Monotone Instrumental Variable (MIV): additional constraints

### 3. **Federated Aggregation Strategies**
Compare weighting schemes for combining site-specific bounds:
- **Sample-size weighting (n):** Weight by site sample size
- **Square-root weighting (√n):** Compromise between equal and sample-size
- **Logarithmic weighting (log n):** Down-weight large heterogeneous sites
- **Power weighting (n^α):** Flexible family with tunable α ∈ [0,1]

## Data

### Synthea 1k Dataset (Primary Development)
- **Patients:** 1,130
- **Sites:** 3 (Hospital-1, Hospital-2, Hospital-3)
- **Scenario:** Diabetes treatment and outcomes
- **Location:** `research/data/raw/splits/1k/`

### Future Scaling
- Synthea 100k: Method validation
- Synthea 2.8M: Scalability testing
- MIMIC-IV demo: Real-world validation

## Folder Structure

```
federated-partial-identification/
├── theory/          # Mathematical foundations, proofs, derivations
├── simulations/     # Synthetic data experiments
├── prototypes/      # Algorithm implementations and prototypes
├── omop-demos/      # OMOP CDM demonstrations using Synthea 1k
├── manuscripts/     # Papers, reports, figures
├── benchmarks/      # Performance evaluations
└── pipelines/       # Automation scripts (npm scripts)
```

## Module Scripts

From `research/modules/2-federated-partial-identification/` you can run:

```bash
npm run demo:balke-pearl      # Run Balke-Pearl bounds on 1k data
npm run demo:manski           # Run Manski bounds on 1k data
npm run demo:aggregation      # Compare aggregation strategies
npm run benchmark:1k          # Benchmark performance on 1k dataset
npm run paper:plots           # Generate manuscript figures
npm run paper:pdf             # Render manuscript PDF
```

*(Scripts will be implemented incrementally)*

## Implementation Roadmap

### Phase 1: Core Bounds Computation (Current)
- [x] Set up module structure
- [ ] Implement Balke-Pearl LP solver
- [ ] Implement Manski bounds (worst-case, MTR, MIV)
- [ ] Unit tests for bound computation

### Phase 2: Federated Aggregation
- [ ] Implement weighting strategies
- [ ] Site-level bound computation
- [ ] Federated aggregation algorithms
- [ ] Privacy-preserving protocols

### Phase 3: OMOP Demonstrations
- [ ] Load Synthea 1k split data
- [ ] Extract treatment/outcome variables
- [ ] Run federated partial identification
- [ ] Generate comparison reports

### Phase 4: Manuscript and Validation
- [ ] Benchmark against centralized bounds
- [ ] Heterogeneity analysis across sites
- [ ] Manuscript draft and figures
- [ ] Validation on 100k data

## Key Algorithms

### Balke-Pearl Bounds (LP Formulation)

For instrumental variable Z, treatment T, outcome Y:

```
Minimize/Maximize: Σ p(y|do(t)) * y
Subject to:
  - p(t,y|z) = Σ p(t,y|z,U) * p(U)  for all z
  - Monotonicity: p(t=1|z=1,U) ≥ p(t=1|z=0,U)
  - Simplex constraints on p(U)
```

### Manski Worst-Case Bounds

```
Lower bound: E[Y|T=1] * P(T=1)  +  0 * P(T=0)
Upper bound: E[Y|T=1] * P(T=1)  +  1 * P(T=0)
```

### Federated Sample-Size Weighted Bounds

```
Global Lower = Σ_s (n_s / N) * Lower_s
Global Upper = Σ_s (n_s / N) * Upper_s
```

## Technical Stack

- **Language:** TypeScript / Node.js
- **Optimization:** Linear Programming solvers (glpk.js, lpsolve, or highs)
- **Data Format:** OMOP CDM (CSV/JSON)
- **Statistics:** Propensity scores, stratification, weighting
- **Visualization:** Chart.js for bound plots

## Dependencies

Shared libraries from `src/`:
- Federated computation primitives
- OMOP CDM data loaders
- Bound computation utilities
- LP solver wrappers
- Aggregation strategies

## References

- Balke, A., & Pearl, J. (1997). *Bounds on treatment effects from studies with imperfect compliance*. JASA.
- Manski, C. F. (1990). *Nonparametric bounds on treatment effects*. AER.
- Imbens, G. W., & Manski, C. F. (2004). *Confidence intervals for partially identified parameters*. Econometrica.

---

**Status:** 🔄 Active Development  
**Data:** Synthea 1k (1,130 patients, 3 sites)  
**Next:** Implement Balke-Pearl LP solver and Manski bounds computation
