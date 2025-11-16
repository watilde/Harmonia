# Manuscript Pipelines

Automation for generating the Manski bounds manuscript assets. Run all commands from `research/modules/manski-bounds/`.

## Commands

```bash
# Rebuild figures from large-scale validation output
npm run paper:plots

# Render the latest manuscript PDF (KaTeX + Highlight.js + Puppeteer)
npm run paper:pdf
```

## Inputs & Outputs

| Command       | Reads                                                                      | Writes                                          |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `paper:plots` | `research/data/raw/results/large-scale-validation/validation-results.json` | `manuscripts/current-paper/figures/*.png`       |
| `paper:pdf`   | `manuscripts/current-paper/manuscript_v6.0.md` + generated figures         | `manuscripts/current-paper/manuscript_v6.0.pdf` |

> Tip: Generate validation results first via `npm run data:validate`.

## Requirements

- Node.js ≥ 16 with `npm install` already run in `research/` (dependencies resolved via the shared `node_modules` directory).
- Chromium support for Puppeteer when running `paper:pdf`.

No Python, TeX, or pandoc dependencies are required; everything runs inside Node.js/TypeScript.
