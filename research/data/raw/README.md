# Raw Data Directory

This directory (formerly `data-generation/`) contains downloaded and generated OMOP CDM data.

## Structure

```
raw/
├── omop-data/        # Downloaded Synthea OMOP data from S3
│   ├── synthea1k/    # 1,000 patients
│   ├── synthea100k/  # 100,000 patients
│   └── synthea2.3m/  # 2,300,000 patients
├── splits/           # Split data for federated learning
├── results/          # Validation results
└── archive/          # Archived documentation
```

## Usage

All scripts are run from the `research/` directory using npm scripts.

See `research/docs/DATA_GENERATION_GUIDE.md` for complete workflow documentation.

## Quick Commands

```bash
cd /home/user/webapp/research

# Download data from AWS Open Data Registry
npm run data:download

# Validate data at all scales
npm run data:validate

# Split data for federated learning
npm run data:split
```
