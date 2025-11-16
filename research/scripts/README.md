# Research Scripts

Organized scripts for data management, validation, and paper generation.

## 📁 Directory Structure

```
scripts/
├── data/              # Data management
│   ├── download/      # Download datasets
│   │   ├── synthea.sh
│   │   └── mimic-demo.sh
│   └── split/         # Split data for federated simulation
│       └── split-omop-csv.js
├── validation/        # Validation and scalability testing
│   ├── large-scale.ts
│   └── scalability.sh
└── paper/             # Paper generation
    ├── generate-pdf.js
    └── generate-plots.js
```

## 🚀 Usage

### Data Download

```bash
cd research

# Download Synthea datasets
npm run data:download:1k       # 1,000 patients (~30MB)
npm run data:download:100k     # 100,000 patients (~300MB)
npm run data:download:2.8m     # 2,800,000 patients (~1.5GB)

# Download MIMIC-IV demo
npm run data:download:mimic    # 100 ICU patients
```

### Data Processing

```bash
# Split data for federated simulation (3 sites)
npm run data:split:1k
npm run data:split:100k
npm run data:split:2.8m
```

### Validation

```bash
# Large-scale validation
npm run data:validate

# Scalability validation
npm run paper:scalability
```

### Paper Generation

```bash
# Generate plots (Chart.js)
npm run paper:plots

# Generate PDF (Puppeteer + KaTeX)
npm run paper:pdf
```

## 📦 Data Sources

- **Synthea**: AWS S3 public bucket `s3://synthea-omop/`
- **MIMIC-IV Demo**: PhysioNet (requires credentials)

## 🔧 Requirements

All scripts are Node.js/TypeScript based:

- No Python dependencies
- No pandoc/LaTeX required
- Puppeteer for PDF generation
- Chart.js for plotting
