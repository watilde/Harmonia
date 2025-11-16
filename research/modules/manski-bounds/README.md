# Federated Manski Bounds Module

This module houses Harmonia's ongoing work on federated Manski bounds, providing partial identification of treatment effects under minimal assumptions.

## Folder Guide

- `experiments/`: the prior OMOP experiments (diabetes, ICU, screening) relocated from `research/experiments`.
- `manuscripts/`: the published manuscript (`manuscript_v6.0.*`) and supporting figures.
- `pipelines/`: module-specific TypeScript scripts (validation + manuscript tooling) invoked via the local `package.json`.

Only these folders are kept to mirror the original repo layout; additional structure can be added later as the project evolves.

## Module Scripts

From `research/modules/manski-bounds/` you can run:

```bash
npm run data:validate        # Large-scale validation
npm run paper:plots          # Regenerate manuscript figures
npm run paper:pdf            # Render manuscript PDF
npm run experiment:diabetes  # Run OMOP experiment (diabetes)
npm run experiment:icu       # Run OMOP experiment (ICU)
npm run experiment:screening # Run OMOP experiment (screening)
```

These commands resolve dependencies from the shared `research/node_modules` tree, so make sure `npm install` has been executed at the `research/` root first.
