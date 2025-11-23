#!/bin/bash
# Design-Failure-Aware: Violation Scenario Testing
# Tests automatic mode selection across different assumption violations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "========================================"
echo "Design-Failure-Aware Violation Scenarios"
echo "========================================"
echo

mkdir -p "$OUTPUT_DIR"

# Test scenarios with different violation severities
for scenario in clean mild moderate severe; do
  echo
  echo "Testing scenario: $scenario"
  echo "----------------------------------------"
  
  echo "  1. Generate data with violations..."
  npx harmonia causal generate-omop-data \
    --scenario diabetes \
    --n 1000 \
    --num-sites 3 \
    --violation-severity "$scenario" \
    --output "$OUTPUT_DIR/$scenario-sites"
  
  echo "  2. Diagnose assumptions..."
  for site in 1 2 3; do
    npx harmonia causal diagnose-assumptions \
      --data "$OUTPUT_DIR/$scenario-sites/site-$site.json" \
      --output "$OUTPUT_DIR/$scenario-site-$site-diagnostics.json"
  done
  
  echo "  3. Automatic mode selection..."
  npx harmonia causal adaptive-inference \
    --diagnostics "$OUTPUT_DIR"/$scenario-site-*-diagnostics.json \
    --data "$OUTPUT_DIR/$scenario-sites" \
    --output "$OUTPUT_DIR/$scenario-report.json"
  
  echo "  ✓ Mode selected and inference completed"
done

echo
echo "✅ All violation scenarios tested!"
echo "📊 Results: $OUTPUT_DIR/*-report.json"
