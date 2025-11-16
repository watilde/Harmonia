# Data Workspace

This directory centralizes raw datasets, processing pipelines, and shared utilities used by every research module.

- `raw/` – former `data-generation/`; contains downloaded OMOP data (`omop-data/`), splits, and validation results.
- `pipelines/` – shared TypeScript automation for dataset downloads and federated splits.
- `shared/` – cross-module datasets, OMOP helpers, and theory references.

Module-specific validation and manuscript pipelines live alongside each module under `research/modules/<module>/pipelines/`.

Use the npm scripts defined in `research/package.json` to invoke the pipelines from the repo root.
