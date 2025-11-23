#!/bin/bash
# Federated Partial Identification: Aggregation Strategy Comparison
# Compares different weighting strategies for federated bounds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "========================================"
echo "Federated Aggregation Strategy Comparison"
echo "========================================"
echo

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Step 1: Generate synthetic multi-site data..."
npx harmonia causal generate-omop-data \
  --scenario diabetes \
  --n 1000 \
  --num-sites 3 \
  --output "$OUTPUT_DIR/sites"

echo
echo "Step 2: Compute site-specific bounds..."
for site in 1 2 3; do
  echo "  Computing bounds for site $site..."
  npx harmonia causal compute-bounds \
    --data "$OUTPUT_DIR/sites/site-$site.json" \
    --assumption mtr \
    --output "$OUTPUT_DIR/site-$site-bounds.json"
done

echo
echo "Step 3: Compare aggregation strategies..."
for strategy in sample-size sqrt-n inverse-width uniform; do
  echo "  Strategy: $strategy"
  npx harmonia causal aggregate-bounds \
    --sites "$OUTPUT_DIR"/site-*-bounds.json \
    --strategy "$strategy" \
    --output "$OUTPUT_DIR/aggregated-$strategy.json"
done

echo
echo "✅ Experiment complete!"
echo "📊 Results saved to: $OUTPUT_DIR"
