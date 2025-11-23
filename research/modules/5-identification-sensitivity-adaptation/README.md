# Federated Robust Causal Inference (FRCI)

End-to-end research framework for three-paper series on privacy-preserving, robust causal inference.

## 📚 Research Overview

### Paper 1: Federated Partial Identification

**Goal**: Establish foundation for federated causal bounds without sharing individual data.

**Key Contributions**:

- Federated Balke-Pearl and Manski bounds computation
- Novel weighting strategies: n, √n, log n, n^α
- Theoretical analysis of optimal weighting under different conditions
- Privacy-preserving aggregation protocols

**Method**:

1. Generate multi-site Synthea data
2. Compute site-specific partial identification bounds
3. Federate bounds using different weighting strategies
4. Evaluate convergence, bias, and coverage properties

### Paper 2: Federated E-values and Robustness Index

**Goal**: Quantify robustness of federated causal inference to unmeasured confounding.

**Key Contributions**:

- Federated E-value aggregation framework
- Novel Federated Robustness Index (FRI) metric
- Controlled confounding injection methodology
- Site-level and global robustness assessment

**Method**:

1. Generate Synthea data with controlled unmeasured confounding
2. Compute site-specific E-values
3. Aggregate into Federated Robustness Index
4. Validate against ground truth confounding strength

### Paper 3: Design-Failure-Aware Federated Causal Learning

**Goal**: Automatic adaptation to assumption violations in federated settings.

**Key Contributions**:

- Multi-assumption diagnostic framework (unconfoundedness, positivity, specification)
- Automatic inference mode selection (point estimate → bounds → E-values)
- Federated assumption score aggregation
- Adaptive reporting based on violation severity

**Method**:

1. Simulate scenarios with varying assumption violations
2. Diagnose violations at each site
3. Automatically select appropriate inference method
4. Generate federated causal reports with appropriate uncertainty quantification

## 🚀 Quick Start

### Prerequisites

```bash
cd research
npm install
```

### Run All Experiments

```bash
# Master E2E pipeline
cd research/modules/5-identification-sensitivity-adaptation
./run-all-experiments.sh
```

### Run Individual Papers

```bash
# Paper 1: Partial Identification
cd experiments/paper1-federated-partial-id
./run-experiment.sh

# Paper 2: Robustness Index
cd experiments/paper2-federated-robustness
./run-experiment.sh

# Paper 3: Design-Failure-Aware
cd experiments/paper3-design-failure-aware
./run-experiment.sh
```

## 📊 Experimental Design

### Paper 1: Weighting Strategy Evaluation

**Conditions**:

- Number of sites: 3, 5, 10
- Sample sizes: Balanced (334 each), Imbalanced (100-1000)
- Effect sizes: Small (0.05), Medium (0.15), Large (0.30)

**Weighting Strategies**:

1. `n` (sample size): w_i = n_i / Σn_j
2. `sqrt-n` (√n): w_i = √n_i / Σ√n_j
3. `log-n` (log n): w_i = log(n_i) / Σlog(n_j)
4. `n-alpha` (n^α): w_i = n_i^α / Σn_j^α (α = 0.5, 0.7, 0.9)
5. `inverse-width` (precision): w_i = (1/width_i) / Σ(1/width_j)
6. `uniform` (equal): w_i = 1/k

**Metrics**:

- Bound width (tightness)
- Coverage of true ATE
- Variance across sites
- Convergence rate

### Paper 2: Confounding Injection

**Confounding Strengths**:

- None: ρ = 0 (baseline)
- Weak: ρ = 0.2
- Moderate: ρ = 0.5
- Strong: ρ = 0.8

**E-value Aggregation**:

- Conservative: min(E_i)
- Optimistic: max(E_i)
- Sample-weighted: Σw_i·E_i
- Variance-weighted: Σ(1/σ_i²)·E_i

**Validation**:

- Compare FRI to known confounding strength
- Evaluate detection sensitivity
- Assess false positive rates

### Paper 3: Violation Scenarios

**Unconfoundedness Violations**:

- Clean: No hidden confounders
- Mild: 1 unmeasured confounder (r² = 0.1)
- Moderate: 2-3 confounders (r² = 0.3)
- Severe: Multiple confounders (r² = 0.5+)

**Positivity Violations**:

- Full overlap: P(T|X) ∈ [0.1, 0.9]
- Mild: P(T|X) ∈ [0.05, 0.95]
- Moderate: P(T|X) ∈ [0.01, 0.99]
- Severe: Sparse regions with P(T|X) < 0.01

**Specification Violations**:

- Correct: Linear model, linear truth
- Mild: Linear model, slight nonlinearity
- Moderate: Linear model, quadratic truth
- Severe: Linear model, complex interactions

**Automatic Mode Selection**:

```
Overall Score > 0.8  → Point Estimate (OLS/IPW)
0.5 < Score ≤ 0.8    → Partial ID Bounds
Score ≤ 0.5          → E-values + Bounds
```

## 📁 Data Generation

### Synthea Configuration

```json
{
  "population": 1000,
  "treatment_rate": 0.5,
  "baseline_outcome": 0.4,
  "ate": 0.15,
  "confounding_strength": "variable",
  "num_sites": 3,
  "site_heterogeneity": "low|medium|high"
}
```

### Site Splitting Strategies

- Random: Uniform random assignment
- Stratified: Balance by age/gender
- Geographic: Region-based (simulated)
- Temporal: Time-based cohorts

## 🔧 Tools & Commands

### Harmonia CLI Integration

All experiments use the Harmonia CLI for reproducibility:

```bash
# Generate data
harmonia causal generate-data -n 1000 --treatment-rate 0.5 --output data.json

# Compute bounds
harmonia causal compute-bounds --data data.json --assumption mtr -o bounds.json

# Federate bounds
harmonia causal federate-bounds -s site1.json site2.json site3.json -o fed.json

# Diagnose assumptions
harmonia causal diagnose-assumptions --data-file data.json --format table

# Compute E-values
harmonia causal compute-evalue --bounds-file bounds.json --baseline-risk 0.4

# Compute FRI
harmonia causal compute-fri --sites-file evalues.json --strategy sample-size
```

## 📈 Expected Outputs

### Paper 1 Outputs

```
results/
├── bounds_by_strategy.csv
├── convergence_plots.png
├── coverage_analysis.csv
├── optimal_weights_conditions.csv
└── paper1_report.pdf
```

### Paper 2 Outputs

```
results/
├── fri_by_confounding.csv
├── evalue_distributions.png
├── sensitivity_analysis.csv
├── detection_roc.png
└── paper2_report.pdf
```

### Paper 3 Outputs

```
results/
├── mode_selection_accuracy.csv
├── assumption_scores_heatmap.png
├── inference_adaptation.csv
├── federated_reports/
│   ├── scenario_clean.pdf
│   ├── scenario_mild.pdf
│   ├── scenario_moderate.pdf
│   └── scenario_severe.pdf
└── paper3_report.pdf
```

## 🧪 Testing

### Unit Tests

```bash
# Test individual components
npm test -- frci
```

### Integration Tests

```bash
# Test end-to-end pipelines
./test-integration.sh
```

### Validation

```bash
# Validate against theoretical properties
./validate-results.sh
```

## 📖 Documentation

- [Paper 1 Methodology](experiments/paper1-federated-partial-id/README.md)
- [Paper 2 Methodology](experiments/paper2-federated-robustness/README.md)
- [Paper 3 Methodology](experiments/paper3-design-failure-aware/README.md)
- [API Reference](../../cli-workflows/README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

## 🤝 Contributing

This research framework is designed for reproducibility and extension.

### Adding New Experiments

1. Create experiment directory under `experiments/`
2. Add scenario configuration to `scenarios/`
3. Implement using Harmonia CLI commands
4. Document in experiment README

### Extending Analysis

- New weighting strategies: Edit `scenarios/01-*.json`
- New violation types: Add to `scenarios/03-*.json`
- New metrics: Extend post-processing scripts

## 📚 Citation

```bibtex
@article{frci2024paper1,
  title={Federated Partial Identification: Privacy-Preserving Causal Bounds},
  author={...},
  journal={...},
  year={2024}
}

@article{frci2024paper2,
  title={Federated Robustness Index: Quantifying Causal Inference Reliability},
  author={...},
  journal={...},
  year={2024}
}

@article{frci2024paper3,
  title={Design-Failure-Aware Federated Causal Learning},
  author={...},
  journal={...},
  year={2024}
}
```

## 📄 License

Apache-2.0

## 🔗 Related Projects

- [Harmonia Core](../../../packages/core/)
- [CLI Workflows](../../cli-workflows/)
- [Manski Bounds Module](../1-manski-bounds/)

---

**Status**: 🚧 Active Development

**Last Updated**: 2025-11-22

**Contact**: research@harmonia.ai
