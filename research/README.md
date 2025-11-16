# Research: Federated Partial Identification

Multi-site causal inference research using Manski bounds and OMOP CDM.

## 📄 Main Paper

**[paper/manuscript_v6.0.md](paper/manuscript_v6.0.md)** - Research manuscript (72KB, 9,800 words)

**Key Contributions**:

1. Federated aggregation preserves identified sets (Theorem 1)
2. O(N) scalability (617ms for 2.8M patients)
3. Privacy-preserving (3 numbers per site)
4. Disease-agnostic OMOP CDM integration

## 🚀 Quick Start

```bash
cd research

# Install dependencies
npm install

# Download Synthea data (1k, 100k, or 2.8m patients)
npm run data:download:100k

# Split for federated simulation (3 sites)
npm run data:split:100k

# Run validation
npm run data:validate

# Generate paper plots
npm run paper:plots
```

## 📁 Directory Structure

```
research/
├── paper/                      # Research manuscript
│   ├── manuscript_v6.0.md
│   ├── manuscript_v6.0.pdf
│   └── figures/                # Publication figures
│
├── scripts/
│   ├── data-generation/        # Download & split Synthea data
│   └── paper/                  # Generate figures & PDF
│
├── experiments/                # Experiment scripts
│   ├── diabetes-medication/
│   ├── icu-intervention/
│   └── preventive-screening/
│
└── data-generation/            # Data (gitignored)
    ├── omop-data/              # Synthea CSV files
    ├── splits/                 # Split for federated simulation
    └── results/                # Validation results
```

## 🔬 Experiments

### Download Synthea Data

```bash
# Small (1k patients, ~30MB)
npm run data:download:1k

# Medium (100k patients, ~300MB)
npm run data:download:100k

# Large (2.8M patients, ~1.5GB)
npm run data:download:2.8m
```

### Split for Federation

```bash
# Split into 3 sites
npm run data:split:1k
npm run data:split:100k
npm run data:split:2.8m
```

### Run Validation

```bash
# Large-scale validation (all scales)
npm run data:validate

# Generate scalability plots
npm run paper:plots
```

### Run Experiments

```bash
# Individual experiments
npm run experiment:diabetes
npm run experiment:icu
npm run experiment:screening
```

## 📊 Key Results

**Scalability** (Synthea synthetic data):

| Dataset      | N Patients | Bounds Time | Memory | Per-Patient |
| ------------ | ---------- | ----------- | ------ | ----------- |
| Synthea-1k   | 1,000      | 1ms         | <1MB   | 1.0μs       |
| Synthea-100k | 100,000    | 45ms        | 11MB   | 0.45μs      |
| Synthea-2.8m | 2,800,000  | 617ms       | 228MB  | 0.22μs      |

**Validation** (Monte Carlo, 1,000 iterations):

- Worst-case: 100% coverage
- MTR: 99.1% coverage
- MTS: 97.8% coverage
- MTR+MTS: 98.5% coverage

## 🧪 Experiment Types

### Single OMOP Experiments (Quick validation)

```bash
npm run experiment:diabetes  # Diabetes medication effectiveness
npm run experiment:icu       # ICU early intervention
npm run experiment:screening # Cancer screening
```

**Output**: `experiments/{scenario}/output-omop/`  
**Time**: ~5 seconds per experiment

### Multi-Assumption Experiments (Detailed analysis)

Compare all 4 identifying assumptions:

- **Worst-case**: No assumptions (widest bounds)
- **MTR**: Monotone Treatment Response (treatment never harms)
- **MTS**: Monotone Treatment Selection (sicker patients get treated)
- **MTR+MTS**: Both assumptions (narrowest bounds)

```bash
npm run experiment:diabetes:multi
npm run experiment:icu:multi
npm run experiment:screening:multi
```

### MIMIC-IV Real Data Validation

✅ **Validated on real ICU patients** (100 patients from Beth Israel Deaconess Medical Center)

**Download MIMIC-IV Demo data**:

```bash
cd research/scripts
bash download-mimic-omop-demo.sh
```

**Requirements**: PhysioNet account (free, requires registration and credentialing)

**Results**:

- **Dataset**: MIMIC-IV Demo OMOP CDM v5.3 (100 patients)
- **Performance**: MTR+MTS achieved 73% width reduction vs worst-case
- **Finding**: Comparable performance to synthetic data, confirming method robustness

## 📚 Documentation

- **[paper/manuscript_v6.0.md](paper/manuscript_v6.0.md)** - Main manuscript
- **[paper/manuscript_v6.0.pdf](paper/manuscript_v6.0.pdf)** - PDF version

## 🛠️ Technology Stack

- **Language**: TypeScript/Node.js
- **Data**: Synthea OMOP CDM (AWS S3)
- **Algorithms**: Manski bounds (4 assumption levels)
- **Plots**: Python (matplotlib, seaborn)
- **Paper**: Markdown → PDF (pandoc, XeLaTeX)

## 📝 npm Scripts

```json
{
  "data:download:1k": "Download Synthea 1k dataset",
  "data:download:100k": "Download Synthea 100k dataset",
  "data:download:2.8m": "Download Synthea 2.8m dataset",
  "data:split:1k": "Split 1k data into 3 sites",
  "data:split:100k": "Split 100k data into 3 sites",
  "data:split:2.8m": "Split 2.8m data into 3 sites",
  "data:validate": "Run large-scale validation",
  "paper:plots": "Generate scalability plots",
  "paper:pdf": "Generate PDF from markdown",
  "experiment:diabetes": "Run diabetes experiment",
  "experiment:icu": "Run ICU experiment",
  "experiment:screening": "Run screening experiment"
}
```

## 🎯 Research Objective

Enable multi-site causal inference while:

1. **Preserving privacy**: No patient-level data sharing
2. **Honest uncertainty**: Bounds instead of point estimates
3. **Minimal assumptions**: Shape restrictions, not untestable confounders
4. **Scalable**: O(N) computation for millions of patients

---

_Privacy-preserving causal inference for multi-site observational studies._
