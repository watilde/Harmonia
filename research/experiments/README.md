# Causal Inference Experiments

This directory contains end-to-end experiment scripts for evaluating federated partial identification methods across three clinical scenarios.

## 🎯 Three Types of Experiments

### 1. **Single-Assumption Experiments** (`run-experiment.sh`)

- Tests ONE assumption level (typically MTR)
- Tests FOUR aggregation strategies (weighted-average, conservative, uniform, inverse-width)
- Good for exploring federation strategies
- **Issue**: MTR fails coverage with positive confounding
- **Data**: Simple synthetic generation

### 2. **Multi-Assumption Experiments** (`run-experiment-multi-assumption.sh`) ⭐ **Recommended**

- Tests ALL FOUR assumption levels (worst-case, MTR, MTS, MTR+MTS)
- Uses weighted-average aggregation (standard approach)
- **Demonstrates informativeness vs. coverage trade-off**
- **Shows why MTS is optimal for observational health studies**
- **Data**: Simple synthetic generation

### 3. **OMOP Data Experiments** (`run-experiment-omop.sh`) 🏥 **Realistic**

- Tests ALL FOUR assumption levels with OMOP CDM-structured data
- Uses realistic EHR data patterns with proper confounding
- **Demonstrates real-world applicability with standardized data model**
- **Data**: OMOP CDM synthetic patient records (Synthea-like)

## 📁 Directory Structure

```
experiments/
├── diabetes-medication/
│   ├── run-experiment.sh                    # Single assumption (MTR)
│   ├── run-experiment-multi-assumption.sh   # All 4 assumptions ⭐
│   ├── run-experiment-omop.sh               # OMOP data 🏥
│   └── data/omop/                           # OMOP per-site data
├── icu-intervention/
│   ├── run-experiment.sh                    # Single assumption (MTR)
│   ├── run-experiment-multi-assumption.sh   # All 4 assumptions ⭐
│   ├── run-experiment-omop.sh               # OMOP data 🏥
│   └── data/omop/                           # OMOP per-site data
├── preventive-screening/
│   ├── run-experiment.sh                    # Single assumption (MTR)
│   ├── run-experiment-multi-assumption.sh   # All 4 assumptions ⭐
│   ├── run-experiment-omop.sh               # OMOP data 🏥
│   └── data/omop/                           # OMOP per-site data
├── compare-assumptions.sh   # Compare assumptions across all scenarios
└── README.md                # This file
```

## 🎯 Clinical Scenarios

### 1. Diabetes Medication Effectiveness

**Research Question**: Does a new diabetes medication improve glycemic control compared to standard care?

**Configuration**:

- True ATE: 0.15 (15% improvement in HbA1c < 7%)
- Confounding: 0.3 (moderate)
- Sites: 3 hospitals
- Sample size: 1,000 per site (3,000 total)
- Assumption: MTR (medication doesn't worsen outcomes)
- Treatment rate: 0.5 (50%)

**Run**:

```bash
cd diabetes-medication
./run-experiment.sh
```

### 2. ICU Early Intervention Timing

**Research Question**: Does early ICU intervention reduce patient mortality?

**Configuration**:

- True ATE: -0.10 (10% mortality reduction)
- Confounding: 0.4 (confounding-by-indication - sicker patients treated earlier)
- Sites: 4 ICU units
- Sample size: 800 per site (3,200 total)
- Assumption: MTR (early intervention doesn't increase mortality)
- Treatment rate: 0.4 (40%)

**Run**:

```bash
cd icu-intervention
./run-experiment.sh
```

### 3. Preventive Screening Frequency

**Research Question**: Does annual cancer screening improve early detection rates?

**Configuration**:

- True ATE: 0.20 (20% improvement in early detection)
- Confounding: 0.25 (health-conscious selection bias)
- Sites: 5 healthcare systems
- Sample size: 1,200 per site (6,000 total)
- Assumption: MTR (annual screening doesn't worsen outcomes)
- Treatment rate: 0.35 (35%)

**Run**:

```bash
cd preventive-screening
./run-experiment.sh
```

## 🔄 Experiment Workflow

Each script follows a standardized 4-step workflow:

### Step 1: Generate Synthetic Data

- Creates observational data for each site
- Uses seeded random generation for reproducibility
- Incorporates confounding based on configuration
- Outputs: `site{N}-data.json`

### Step 2: Compute Local Bounds

- Computes partial identification bounds at each site
- Uses specified assumption level (MTR, MTS, MTR-MTS, worst-case)
- Checks coverage of true ATE
- Outputs: `site{N}-bounds.json`

### Step 3: Federate Bounds

- Aggregates bounds across sites using multiple strategies:
  - **Weighted-average**: Weight by sample size (standard meta-analytic)
  - **Conservative**: Most cautious (widest bounds)
  - **Uniform**: Equal weight to each site
  - **Inverse-width**: Weight by informativeness (narrower = higher weight)
- Outputs: `federated-{strategy}.json`

### Step 4: Generate Report

- Creates comprehensive markdown summary
- Includes clinical interpretation
- Reports coverage, bound widths, and communication cost
- Output: `REPORT.md` or `SUMMARY.md`

## 🔬 Multi-Assumption Analysis

### Why Test Multiple Assumptions?

**The Problem**: MTR alone fails with positive confounding (observed in all 3 scenarios)

**The Solution**: Test all 4 assumptions to understand the informativeness vs. coverage trade-off

### The Four Assumption Levels

| Assumption     | Definition             | When to Use               | Typical Width  | Coverage            |
| -------------- | ---------------------- | ------------------------- | -------------- | ------------------- |
| **worst-case** | No assumptions         | Unknown confounding       | 1.0 (widest)   | ✅ Always           |
| **MTR**        | Treatment doesn't harm | No confounding            | 0.5 (tight)    | ❌ With confounding |
| **MTS**        | Selection by baseline  | Confounding-by-indication | 0.8 (moderate) | ✅ With confounding |
| **MTR+MTS**    | Both MTR and MTS       | Strong justification      | 0.3 (tightest) | ❌ Too restrictive  |

### Running Multi-Assumption Analysis

```bash
# Diabetes medication example
cd diabetes-medication
./run-experiment-multi-assumption.sh

# Output includes comparison table:
# Assumption      Bounds                 Width    Coverage
# worst-case      [-0.342, 0.658]       1.000    ✅ Yes
# mtr             [0.170, 0.658]        0.489    ❌ No
# mts             [-0.342, 0.489]       0.830    ✅ Yes   ⭐
# mtr-mts         [0.170, 0.489]        0.319    ❌ No
```

### Key Findings Across All Scenarios

**✅ MTS achieves coverage in all 3 scenarios** (diabetes, ICU, screening)

**❌ MTR fails coverage in all 3 scenarios** due to positive confounding

**Why MTR Fails**:

- MTR lower bound = E[Y|T=1] - E[Y|T=0]
- E[Y|T=1] includes confounding bias
- With positive confounding: sicker patients → treatment
- Result: E[Y|T=1] > true causal effect
- Lower bound too high → misses true ATE

**Why MTS Succeeds**:

- MTS assumes E[Y(0)|T=1] ≥ E[Y(0)|T=0]
- Accounts for confounding-by-indication
- Clinically plausible: treated patients have better/worse baseline
- Result: Valid bounds that contain true ATE

### Recommendation

**Use MTS (Monotone Treatment Selection)** for observational health studies:

- ✅ Achieves valid coverage (essential for inference)
- ✅ Tighter than worst-case (16-50% width reduction)
- ✅ Clinically plausible (confounding-by-indication)
- ✅ Accounts for selection bias

### Comparison Script

Run comparison across all scenarios:

```bash
./compare-assumptions.sh
```

This script:

- Tests all 4 assumptions on all 3 scenarios
- Generates formatted comparison tables
- Provides clinical interpretation
- Documents key findings for manuscript

## 📊 Output Structure

After running an experiment, you'll find:

```
{scenario}/output/run_{timestamp}/
├── data/
│   ├── site1-data.json
│   ├── site2-data.json
│   └── ...
├── bounds/
│   ├── site1-bounds.json
│   ├── site2-bounds.json
│   └── ...
├── results/
│   ├── federated-weighted-average.json
│   ├── federated-conservative.json
│   ├── federated-uniform.json
│   ├── federated-inverse-width.json
│   └── REPORT.md (or SUMMARY.md)
```

## 🔑 Key Metrics

Each experiment reports:

1. **Bounds**: [lower, upper] interval for ATE
2. **Width**: Informativeness measure (narrower = more informative)
3. **Coverage**: Whether true ATE falls within bounds
4. **Communication Cost**: Bytes shared between sites (~50 bytes/site)
5. **Sample Sizes**: Per-site and total participants

## 🎓 Understanding the Results

### Coverage

- ✅ **Yes**: True ATE is within computed bounds (expected)
- ❌ **No**: True ATE is outside bounds (unexpected - may indicate assumption violation or synthetic data issue)

### Bound Width

- **Narrow bounds** (< 0.3): High informativeness despite unmeasured confounding
- **Moderate bounds** (0.3-0.6): Meaningful causal signal but substantial uncertainty
- **Wide bounds** (> 0.6): Limited informativeness, strong unmeasured confounding

### Aggregation Strategies

- **Weighted-average**: Best for typical meta-analysis (primary analysis)
- **Conservative**: Best for high-stakes decisions requiring maximum caution
- **Uniform**: Best for testing robustness across heterogeneous sites
- **Inverse-width**: Best when sites vary greatly in informativeness

## 🏥 OMOP Data Experiments

The OMOP experiments use OMOP CDM (Common Data Model) structured synthetic patient data instead of simple synthetic generation.

### Why OMOP?

1. **Realistic Data Structure**: Standard OMOP tables (PERSON, DRUG_EXPOSURE, MEASUREMENT, VISIT_OCCURRENCE, PROCEDURE_OCCURRENCE)
2. **Clinical Plausibility**: Proper concept IDs from OHDSI Athena vocabulary
3. **Confounding Patterns**: Realistic confounding-by-indication scenarios
4. **Interoperability**: Compatible with real EHR systems

### Data Generation Pipeline

```bash
# Step 1: Generate OMOP data for a scenario
cd research/causal-inference/data-generation/synthea
python3 generate-omop-data.py \
  --scenario diabetes \
  --n-patients 1000 \
  --output ../output/diabetes

# Step 2: Split into per-site datasets
cd ..
python3 split-omop-data.py \
  --input output/diabetes/causal-data.json \
  --output-dir ../experiments/diabetes-medication/data/omop \
  --num-sites 3
```

### Running OMOP Experiments

```bash
# Diabetes study with OMOP data
cd experiments/diabetes-medication
./run-experiment-omop.sh

# ICU study with OMOP data
cd experiments/icu-intervention
./run-experiment-omop.sh

# Screening study with OMOP data
cd experiments/preventive-screening
./run-experiment-omop.sh
```

### OMOP vs Simple Synthetic

| Feature           | Simple Synthetic     | OMOP Data                |
| ----------------- | -------------------- | ------------------------ |
| Generation        | Random noise         | Clinical patterns        |
| Data structure    | Treatment + Outcome  | Full OMOP tables         |
| Confounding       | Parameter-based      | Realistic scenarios      |
| Concept IDs       | N/A                  | OHDSI Athena             |
| EHR compatibility | No                   | Yes                      |
| Use case          | Algorithm validation | Real-world applicability |

## 🧪 Customizing Experiments

To modify experiment parameters, edit the configuration section at the top of each script:

```bash
# Configuration
NUM_SITES=3
SAMPLE_SIZE=1000
TRUE_ATE=0.15
CONFOUNDING=0.3
TREATMENT_RATE=0.5
ASSUMPTION="mtr"
SEED_BASE=5000
```

## 📚 Dependencies

These scripts use the Harmonia CLI commands:

```bash
# Generate data
harmonia causal generate-data -o data.json -n 1000 --true-ate 0.15

# Compute bounds
harmonia causal compute-bounds -d data.json -o bounds.json -a mtr

# Federate bounds
harmonia causal federate-bounds -s site1.json site2.json -o federated.json
```

Ensure you've built the CLI:

```bash
npm run build
```

## 🔬 Research Use Cases

These experiments support:

1. **Method Validation**: Verify partial identification algorithms work correctly
2. **Scenario Analysis**: Compare performance across clinical contexts
3. **Sensitivity Analysis**: Test robustness to confounding levels
4. **Aggregation Comparison**: Evaluate different federation strategies
5. **Communication Efficiency**: Demonstrate privacy-preserving properties

## 📝 Citation

When using these experiments in research, please cite:

> "Federated Partial Identification for Multi-site Causal Inference Using Synthetic EHR Data"
>
> [Your Name], [Date]
>
> Implements Manski's partial identification bounds under MTR/MTS assumptions with federated aggregation strategies.

## 🐛 Troubleshooting

**Problem**: Script fails with "command not found"

- **Solution**: Make script executable: `chmod +x run-experiment.sh`

**Problem**: CLI commands fail

- **Solution**: Build the project first: `cd /home/user/webapp && npm run build`

**Problem**: Python errors about float conversion

- **Solution**: Ensure Python 3 is installed: `python3 --version`

**Problem**: Coverage is always "No"

- **Solution**: This may indicate the synthetic data generation needs adjustment or the assumption is too weak for the confounding level

## 🚀 Next Steps

1. Run all three experiments
2. Compare bound widths across scenarios
3. Analyze coverage rates
4. Evaluate aggregation strategy performance
5. Create visualizations of results
6. Write manuscript based on findings

---

**Last Updated**: 2025-11-14
