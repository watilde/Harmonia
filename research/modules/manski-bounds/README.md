# Federated Manski Bounds Module

This module houses Harmonia's ongoing work on federated Manski bounds, providing partial identification of treatment effects under minimal assumptions.

## Folder Guide

- `theory/`: assumptions, derivations, and notation.
- `simulations/`: configs, notebooks, and outputs for synthetic experiments.
- `prototypes/`: CLI proofs of concept and federated runners.
- `omop-demo/`: OMOP CDM scripts and demonstration workflows.
- `manuscripts/`: drafts, figures, and submission artifacts.
- `benchmarks/`: curated datasets (synthetic + demo) with metadata.

Use the README in each subfolder to track lifecycle status (draft → review → publish) and link to shared utilities in `research/data/shared/`.

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
