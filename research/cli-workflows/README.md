# Harmonia CLI Workflows for Research

Comprehensive CLI-based workflows demonstrating the Federated Robust Causal Inference (FRCI) framework using Harmonia CLI commands.

## Quick Start

```bash
cd research/cli-workflows

# Run any workflow
./1-manski-bounds.sh
./2-federated-partial-identification.sh
./3-federated-evalues.sh
./4-design-failure-aware-causal.sh
./5-identification-sensitivity-adaptation.sh
```

---

## Workflows Overview

### 1. Manski Bounds (`1-manski-bounds.sh`)

**Purpose**: Basic partial identification with Manski bounds in federated settings.

**What it does**:

- Generates synthetic OMOP data for 3 hospital sites
- Computes worst-case and MTR bounds at each site
- Federates bounds using different aggregation strategies
- Compares results across strategies

**Run**: `./1-manski-bounds.sh`

**Output**: `output/manski-bounds/`

---

### 2. Federated Partial Identification (`2-federated-partial-identification.sh`)

**Purpose**: Research Module 1 - Optimal weighting strategies for federated bounds.

**What it does**:

- **Experiment 1**: Balanced sites (n=334 each) with strategy comparison
- **Experiment 2**: Imbalanced sites (100, 334, 1000) demonstrating inverse-width advantage
- **Experiment 3**: Worst-case vs MTR bounds comparison

**Key findings**:

- Inverse-width weighting minimizes bound width
- 0.44% tighter than sample-size weighting in imbalanced settings
- 2.2% tighter than conservative aggregation

**Run**: `./2-federated-partial-identification.sh`

**Output**: `output/federated-partial-id/`

**Research manuscript**: `research/modules/2-federated-partial-identification/manuscripts/manuscript_v1.0.md`

---

### 3. Federated E-values (`3-federated-evalues.sh`)

**Purpose**: Research Module 2 - Federated Robustness Index for multi-site sensitivity analysis.

**What it does**:

- Generates data for 5-site hospital network (varying sizes: 90-800 patients)
- Computes bounds and E-values at each site
- Calculates Federated Robustness Index (FRI)
- Compares FRI aggregation strategies (sample-size, sqrt, log, equal)
- Assesses network-wide robustness levels

**Key findings**:

- FRI aggregates robustness evidence across heterogeneous sites
- Sample-size weighting recommended for FRI
- Network FRI correlates with confounding strength (r=-0.96)

**Run**: `./3-federated-evalues.sh`

**Output**: `output/federated-evalues/`

**Research manuscript**: `research/modules/3-federated-evalues/manuscripts/manuscript_v1.0.md`

---

### 4. Design-Failure-Aware Causal (`4-design-failure-aware-causal.sh`)

**Purpose**: Research Module 3 - Automatic adaptation to assumption violations.

**What it does**:

- Generates data for different violation scenarios (clean, mild, moderate, severe)
- Diagnoses assumptions for each scenario
- Automatically selects appropriate inference mode
- Applies the right analysis method based on violations
- Generates summary report

**Key findings**:

- Automatic mode switching based on diagnostics
- Safe causal inference under violations
- Conservative estimation when needed

**Run**: `./4-design-failure-aware-causal.sh`

**Output**: `output/design-failure-aware/`

**Research manuscript**: `research/modules/4-design-failure-aware-causal/manuscripts/manuscript_v1.0.md`

---

### 5. Identification-Sensitivity-Adaptation Complete Pipeline (`5-identification-sensitivity-adaptation.sh`)

**Purpose**: Complete hierarchical framework integration - all three research modules.

**What it does**:

1. **Module 0**: Generate 4-hospital network data
2. **Module 3**: Run assumption diagnostics at each site
3. **Module 3**: Automatic inference mode selection per site
4. **Module 1**: Compute partial identification bounds
5. **Module 1**: Federate with optimal aggregation strategy
6. **Module 2**: Calculate E-values and FRI
7. **Integration**: Adaptive network-wide decision making

**Key features**:

- Demonstrates complete hierarchical framework end-to-end
- Automatic adaptation based on site quality
- Integrated decision making across modules
- Comprehensive summary report (Markdown)

**Run**: `./5-identification-sensitivity-adaptation.sh`

**Output**: `output/identification-sensitivity-adaptation/summary.md`

---

## CLI Commands Reference

### Data Generation

```bash
harmonia causal generate-data -n 334 --output site-data.json
```

### Assumption Diagnostics

```bash
harmonia causal diagnose-assumptions \
  --data-file site-data.json \
  --output diagnostics.json
```

### Bounds Computation

```bash
# MTR bounds
harmonia causal compute-bounds \
  --data site-data.json \
  --assumption mtr \
  --output bounds.json
```

### Bounds Federation

```bash
harmonia causal federate-bounds \
  -s site1-bounds.json site2-bounds.json site3-bounds.json \
  --strategy inverse-width \
  --output federated-bounds.json
```

### E-value Sensitivity Analysis

```bash
harmonia causal compute-evalue \
  --bounds-file bounds.json \
  --output evalues.json
```

### Federated Robustness Index

```bash
harmonia causal compute-fri \
  --sites-file site-evalues.json \
  --strategy sample-size \
  --output fri.json
```

---

## Utility Functions

The `utils/` directory contains shared utilities:

### `utils/shared-functions.sh`

Comprehensive bash function library (420 lines, 18 functions):

- **Data Generation**: `generate_site_data()`, `generate_balanced_sites()`, `generate_imbalanced_sites()`
- **Bounds Computation**: `compute_site_bounds()`, `compute_bounds_for_sites()`
- **Federation**: `federate_bounds_with_strategy()`, `compare_aggregation_strategies()`
- **E-values & FRI**: `compute_evalue_from_bounds()`, `compute_fri()`, `compare_fri_strategies()`
- **Diagnostics**: `diagnose_site_assumptions()`, `display_assumption_scores()`
- **Reporting**: `print_section_header()`, `print_success()`, etc.

**Usage in your scripts**:

```bash
source "utils/shared-functions.sh"

generate_balanced_sites 334 "$OUTPUT_DIR" "site" 3
compare_aggregation_strategies "$OUTPUT_DIR" "prefix" bounds*.json
compare_fri_strategies sites.json "$OUTPUT_DIR" "network"
```

---

## Prerequisites

1. **Build the CLI**:

```bash
cd /home/user/webapp
npm run build -w @harmonia/cli
npm run build -w @harmonia/core
```

2. **Install jq** (for JSON processing):

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

3. **Ensure scripts are executable** (already done):

```bash
chmod +x *.sh
```

---

## Workflow Selection Guide

| Research Goal                      | Workflow                                   | Output              |
| ---------------------------------- | ------------------------------------------ | ------------------- |
| Learn basic partial identification | 1-manski-bounds.sh                         | Basic bounds demo   |
| Module 1: Optimal weighting        | 2-federated-partial-identification.sh      | Strategy comparison |
| Module 2: Robustness assessment    | 3-federated-evalues.sh                     | FRI and E-values    |
| Module 3: Assumption violations    | 4-design-failure-aware-causal.sh           | Adaptive inference  |
| Complete hierarchical framework    | 5-identification-sensitivity-adaptation.sh | Integrated pipeline |

---

## Directory Structure

```
cli-workflows/
├── README.md (this file)
├── 1-manski-bounds.sh
├── 2-federated-partial-identification.sh
├── 3-federated-evalues.sh
├── 4-design-failure-aware-causal.sh
├── 5-identification-sensitivity-adaptation.sh
├── utils/
│   ├── shared-functions.sh (comprehensive function library)
│   └── prepare-mimic-data.ts (MIMIC data preparation)
└── output/ (generated by workflows)
    ├── manski-bounds/
    ├── federated-partial-id/
    ├── federated-evalues/
    ├── design-failure-aware/
    └── identification-sensitivity-adaptation/
```

---

## Research Manuscripts

These workflows implement the research methods:

1. **Federated Partial Identification** - Optimal weighting strategies
   - Workflow: `2-federated-partial-identification.sh`
   - Manuscript: `research/modules/2-federated-partial-identification/manuscripts/manuscript_v1.0.md`
   - Figures: `research/modules/2-federated-partial-identification/manuscripts/figure*.png`

2. **Federated E-values & FRI** - Multi-site sensitivity analysis
   - Workflow: `3-federated-evalues.sh`
   - Manuscript: `research/modules/3-federated-evalues/manuscripts/manuscript_v1.0.md`
   - Figures: `research/modules/3-federated-evalues/manuscripts/figure*.png`

3. **Design-Failure-Aware** - Automatic assumption adaptation
   - Workflow: `4-design-failure-aware-causal.sh`
   - Manuscript: `research/modules/4-design-failure-aware-causal/manuscripts/manuscript_v1.0.md`
   - Figures: `research/modules/4-design-failure-aware-causal/manuscripts/figure*.png`

4. **Hierarchical Framework** - Integrated framework (Identification-Sensitivity-Adaptation)
   - Workflow: `5-identification-sensitivity-adaptation.sh`
   - All three modules combined

---

## Benefits

✅ **Complete Coverage**: All research modules have CLI workflows  
✅ **Manuscript Alignment**: Direct correspondence to research papers  
✅ **Reproducibility**: Shell scripts document exact methodology  
✅ **Accessibility**: No programming knowledge required  
✅ **Modularity**: Reusable functions in shared library  
✅ **Integration**: Easy to incorporate into pipelines  
✅ **Education**: Step-by-step demonstrations

---

## References

- Manski, C. F. (2003). _Partial Identification of Probability Distributions_
- VanderWeele, T. J., & Ding, P. (2017). _Sensitivity analysis in observational research_
- Pearl, J. (2009). _Causality: Models, Reasoning, and Inference_
- Ding, P., & VanderWeele, T. J. (2016). _Sensitivity analysis without assumptions_

---

## Support

For questions or issues:

1. Check CLI help: `npx harmonia causal --help`
2. See command-specific help: `npx harmonia causal compute-bounds --help`
3. Review output JSON files for details
4. Check the main Harmonia documentation
5. Review research manuscripts for methodology

---

**Last Updated**: 2025-11-23  
**Hierarchical Framework Version**: 1.0  
**Harmonia CLI Version**: Latest
