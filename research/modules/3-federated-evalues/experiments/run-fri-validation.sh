#!/bin/bash
# Federated E-values: FRI Validation with Controlled Confounding
# Tests Federated Robustness Index across different confounding levels

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "========================================"
echo "Federated Robustness Index Validation"
echo "========================================"
echo

mkdir -p "$OUTPUT_DIR"

# Test different confounding strengths
for rho in 0.0 0.2 0.5 0.8; do
  echo
  echo "Testing confounding strength: ρ = $rho"
  echo "----------------------------------------"
  
  echo "  1. Generate data with controlled confounding..."
  npx harmonia causal generate-omop-data \
    --scenario diabetes \
    --n 1000 \
    --num-sites 5 \
    --confounding-strength "$rho" \
    --output "$OUTPUT_DIR/rho-$rho-sites"
  
  echo "  2. Compute bounds for each site..."
  for site in 1 2 3 4 5; do
    npx harmonia causal compute-bounds \
      --data "$OUTPUT_DIR/rho-$rho-sites/site-$site.json" \
      --assumption mtr \
      --output "$OUTPUT_DIR/rho-$rho-site-$site-bounds.json"
  done
  
  echo "  3. Compute E-values and FRI..."
  npx harmonia causal compute-fri \
    --bounds "$OUTPUT_DIR"/rho-$rho-site-*-bounds.json \
    --baseline-risk 0.4 \
    --output "$OUTPUT_DIR/rho-$rho-fri.json"
done

echo
echo "✅ FRI validation complete!"
echo "📊 Results: $OUTPUT_DIR/rho-*-fri.json"
