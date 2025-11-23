# Testing Workflows

Test all research modules with multiple datasets.

## Datasets

| Dataset    | Size               | Sites | Purpose        |
| ---------- | ------------------ | ----- | -------------- |
| 1k         | 1,000 patients     | 3     | Fast iteration |
| 100k       | 100,000 patients   | 3     | Medium-scale   |
| 2.8m       | 2,800,000 patients | 3     | Large-scale    |
| mimic-demo | 100 patients       | 1     | Clinical data  |

## Usage

**Test all (5 modules × 4 datasets):**

```bash
./test-all-datasets.sh
```

**Test specific datasets:**

```bash
./test-all-datasets.sh --datasets 1k
./test-all-datasets.sh --datasets 1k,100k
```

**Test specific modules:**

```bash
./test-all-datasets.sh --modules 1,2
./test-all-datasets.sh --datasets 1k --modules 2,3
```

## Setup

```bash
# Download data
cd research
npm run data:download:1k
npm run data:split:1k

# Build CLI
npm run build -w @harmonia/cli
npm run build -w @harmonia/core
```

## Output

Results saved to `output/`:

```
output/
├── manski-bounds-1k/
├── manski-bounds-100k/
├── federated-partial-id-1k/
└── ...
```
