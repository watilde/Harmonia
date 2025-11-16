# Data Pipelines

Shared TypeScript automations for downloading and preparing raw datasets used across the Federated Causal Validity Stack.

Module-specific pipelines (validation, manuscripts, etc.) now live with each module under `research/modules/<module>/pipelines/`.

## 📁 Directory Structure

```
pipelines/
└── data/
    ├── download/
    │   ├── synthea.ts
    │   └── mimic-demo.ts
    └── split/
        └── split-omop-csv.ts
```

## 🚀 Usage

Run these commands from `research/`.

### Data Download

```bash
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

After the shared datasets are prepared, switch into the relevant module (for example `research/modules/manski-bounds`) to run module-specific validation or manuscript pipelines.
