# Research Modules

Five research modules for federated causal inference:

1. **Manski Bounds** — Federated partial identification with optimal aggregation
2. **Federated Partial Identification** — Aggregation strategies under heterogeneity
3. **E-values & FRI** — Sensitivity analysis and robustness metrics
4. **Design-Failure-Aware** — Diagnostic systems for assumption violations
5. **Unified Framework** — Integration of all modules

## Structure

```
research/
├── modules/
│   ├── 1-manski-bounds/
│   ├── 2-federated-partial-identification/
│   ├── 3-federated-evalues/
│   ├── 4-design-failure-aware-causal/
│   └── 5-identification-sensitivity-adaptation/
└── data/
```

Each module contains:
- `manuscripts/` — Papers and figures
- `experiments/` — Validation scripts
- `scripts/` — PDF generation

## Usage

**Generate PDFs:**
```bash
cd research/modules/1-manski-bounds
node scripts/generate-pdf.js
```

**Run experiments:**
```bash
cd research/modules/1-manski-bounds
bash experiments/run-manski-experiment.sh
```
