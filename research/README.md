# Federated Causal Validity Stack

Harmonia's research workspace is evolving into a long-term Federated Causal Validity Stack. Each module advances a new capability for federated causal inference:

- **Manski bounds** – partial identification of treatment effects via federated Manski bounds.
- **E-values & Robustness Index** – sensitivity to unmeasured confounding and cross-site robustness metrics.
- **Design-failure-aware learning** – diagnostic signals and adaptive responses when identifying assumptions fail.

## Layout

- `data/`: Raw datasets, splitting pipelines, and shared theory/utilities.
- `modules/`: Houses all research capabilities. Current submodules:
  - `manski-bounds/`
  - `e-values-robustness/`
  - `failure-aware-learning/`

Each module contains structured folders for theory, simulations, prototypes, OMOP demonstrations, manuscripts, and benchmarks. This layout is designed for multi-year collaboration with clear separation of artifacts and reproducible workflows.

## Running Scripts

- Shared data pipelines (download & split) live under `research/data/pipelines/` and are exposed via `research/package.json`.
- Module-specific scripts (validation, manuscript builds, experiments) live inside each module. Change into `research/modules/<module>/` and run `npm run <script>` from there (e.g., `npm run paper:pdf` inside `manski-bounds/`).
