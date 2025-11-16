# Harmonia

Federated partial identification and learning for OMOP CDM networks. The repository is organized around the source code that powers the CLI, coordinator, clients, OMOP connectors, and cryptography helpers that run production workflows. Research artifacts (figures, manuscripts, prototype pipelines) live under `research/`, but this README is dedicated to the code under `packages/*/src`.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Source Layout

```
packages/
  core/src/           # Algorithms & utilities shared by every runtime
  coordinator/src/    # Server that schedules rounds and aggregates updates
  client/src/         # Local training loop and model builders
  cli/src/            # npx harmonia ... commands and services
  crypto/src/         # Hashing and encryption primitives
  omop/src/           # OMOP CDM access, feature builders, and cohorts
research/
  modules/            # Experiments (new modules are added here)
```

Each package ships a `dist/` folder, but all logic is maintained inside `src/`. The following sections highlight what you will find in each `src` tree so you can navigate or extend the system quickly.

### `packages/core/src` — Algorithms & Partial Identification

- `causal/` implements partial identification: OMOP extractors, synthetic data generators, Manski-bounds style aggregation, and tests for federated aggregation.
- `horizontal/` exposes the FedAvg implementation we currently support for horizontal FL. All other algorithms are intentionally removed to keep the surface area small.
- `vertical/` covers split learning, VFL FedAvg, secure aggregation helpers, and privacy-aware embedding aggregation for vertically partitioned data.
- `transfer/` contains FedMD/FMTL transfer learning primitives with accompanying tests.
- `privacy/` handles clipping, budget accounting, and calibrated noise injection used across modules.
- `async/` includes convergence/staleness controllers that protect the coordinator from slow or delayed clients.
- `utils/` and `types/` define shared model utilities, validation helpers, and type guards.

### `packages/coordinator/src` — Round Orchestration

- `federated-coordinator.ts` exposes the coordinator class that schedules rounds, applies aggregation rules, and communicates back to clients.
- `types/` documents the payloads exchanged with clients, including secure aggregation metadata.
- Tests inside the same directory pin coordinator behavior against regressions.

### `packages/client/src` — Local Training Runtime

- `federated-client.ts` is the entry point used by both CLI and research pipelines to simulate or run edge nodes.
- `training/` includes the model builder, trainer, and orchestration helpers that connect to TensorFlow.js and prepare gradients/weights for the coordinator.
- `types/` shares model and transport definitions used to validate CLI input/output.

### `packages/cli/src` — User-Facing Commands

- `cli.ts` wires commands together; exporting through `index.ts` enables `npx harmonia ...`.
- `commands/` holds high-level verbs: cohort/study initialization, causal analysis, coordinator management, and training.
- `services/` and `training/` wrap the lower-level packages to execute hybrid, vertical, and transfer learning pipelines, export/import models, and persist run state.
- `utils/` (error handler, dependency resolver, validation, logging) keeps the CLI predictable; these utilities are unit-tested directly in `__tests__/` and `utils/*.test.ts`.
- `config/` defines default values, prompt schemas, and module resolution rules.

### `packages/crypto/src` — Cryptography Helpers

- `encryption/` provides symmetric and asymmetric helpers used by the CLI, clients, and coordinator to exchange secrets.
- `hashing/` centralizes deterministic hashing (for cohort IDs, file integrity, etc.).
- `index.ts` wires the primitives into a small API tested by `index.test.ts`.

### `packages/omop/src` — OMOP CDM Access

- `connectors/` define base database connectors plus PostgreSQL and SQL Server implementations.
- `cohort/` translates feature specs into OMOP-friendly SQL and exports test fixtures.
- `features/` maps OMOP vocabularies into training-ready tensors.
- `types/` describes cohort definitions, feature specs, and connection options. The CLI consumes these types to guard study configuration before data touches the wire.

### `research/` — Experiment Modules

While this README focuses on `src`, any research module (e.g., `research/modules/manski-bounds`) packages its own pipelines, manuscripts, and experiment notebooks. When a new module is added, it should rely on the APIs documented above instead of duplicating business logic.

## How the Pieces Talk to Each Other

1. The CLI (`packages/cli/src`) validates study configuration, loads OMOP connectors, and spins up a coordinator plus one or more clients.
2. Clients (`packages/client/src`) call into the OMOP helpers and training builders to produce gradients/weights or partial-identification summaries.
3. The coordinator (`packages/coordinator/src`) streams updates through the algorithms exposed by `@harmonia/core`.
4. Crypto helpers secure the payloads, while OMOP adapters keep everything schema-compliant.

Because packages only talk through their published `src/index.ts`, researchers can add new modules under `research/modules/*` without changing the production source tree. Any new research component should depend on `@harmonia/*` workspaces to stay aligned with the main code.

## Getting Started

```bash
git clone https://github.com/watilde/Harmonia.git
cd Harmonia
npm install
npm run build   # compiles every package src/ into dist/
```

Requirements: Node.js ≥ 18 and npm ≥ 9. Optional GPU acceleration is available through `@tensorflow/tfjs-node-gpu`.

## Using the Source

### CLI (via `packages/cli/src`)

```bash
# Generate a synthetic OMOP dataset for a diabetes scenario
npx harmonia causal generate-omop-data \
  --scenario diabetes \
  --output ./omop-data \
  -n 1000

# Run a causal analysis using partial identification bounds
npx harmonia causal analyze \
  --data ./omop-data \
  --scenario diabetes \
  --output results.json
```

### Programmatic (via `packages/core/src`)

```ts
import { computeATEBounds } from '@harmonia/core';

const data = [
  { treatment: 1, outcome: 1 },
  { treatment: 0, outcome: 0 },
];

const worstCase = computeATEBounds(data, { assumption: 'worst-case' });
const mtr = computeATEBounds(data, { assumption: 'mtr' });
```

Use `@harmonia/omop` to build cohorts, `@harmonia/coordinator` to orchestrate rounds, and `@harmonia/client` to embed custom model builders when you need full programmatic control.

## Development Workflow

- `npm run build` — type-checks and compiles every `src` directory through `tsc -b`.
- `npm test` — executes package-level unit tests (Jest).
- `npm run lint` / `npm run format:check` — static analysis for all `src` files.
- `npm run typecheck` — strict TS validation without emitting artifacts.

Use `npm run validate` to run linting, formatting, type-checking, and unit tests in sequence. When working on a specific package, you can switch into it and run the same scripts; they all assume entry points under `src/`.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Citation

```bibtex
@article{harmonia2025,
  title={Federated Partial Identification for Multi-site Causal Inference Using Synthetic EHR Data},
  author={Wachi, Daijiro},
  year={2025},
  note={Available at: https://github.com/watilde/Harmonia}
}
```
