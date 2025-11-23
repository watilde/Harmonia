# Research Modules

Four research modules for federated causal inference:

1. **Federated Partial Identification** — Aggregation strategies under heterogeneity with minimax-optimal inverse-width weighting
2. **E-values & FRI** — Sensitivity analysis and robustness metrics
3. **Design-Failure-Aware** — Diagnostic systems for assumption violations
4. **Unified Framework** — Integration of all modules

## Structure

```
research/
├── modules/
│   ├── 1-federated-partial-identification/
│   ├── 2-federated-evalues/
│   ├── 3-design-failure-aware-causal/
│   └── 4-identification-sensitivity-adaptation/
└── data/
```

Each module contains:

- `manuscripts/` — Papers and figures
- `experiments/` — Validation scripts
- `scripts/` — PDF generation

## Usage

**Generate PDFs:**

```bash
cd research/modules/1-federated-partial-identification
node scripts/generate-pdf.js
```

**Run experiments:**

```bash
cd research/modules/1-federated-partial-identification
bash experiments/run-aggregation-experiment.sh
```
