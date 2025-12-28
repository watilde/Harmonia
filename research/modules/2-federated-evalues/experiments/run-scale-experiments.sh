#!/bin/bash
# Federated E-values: Scale Experiments
# Reproduces Table 1 from Module 2 manuscript
# Tests FRI aggregation at 1k, 100k, and 2.8m patient scales

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/results"

# Parse scale argument
SCALE="${1:-1k}"

case "$SCALE" in
  1k)
    NUM_PATIENTS=1130
    SITE_SIZES="500,400,230"
    ;;
  100k)
    NUM_PATIENTS=235222
    SITE_SIZES="100000,85222,50000"
    ;;
  2.8m)
    NUM_PATIENTS=2709803
    SITE_SIZES="1200000,909803,600000"
    ;;
  *)
    echo "Error: Unknown scale '$SCALE'"
    echo "Usage: $0 {1k|100k|2.8m}"
    exit 1
    ;;
esac

echo "========================================"
echo "Federated E-values Scale Experiment"
echo "Scale: $SCALE ($NUM_PATIENTS patients)"
echo "========================================"
echo

SCALE_DIR="$OUTPUT_DIR/$SCALE"
mkdir -p "$SCALE_DIR"

# Step 1: Generate synthetic data for 3 sites with different sizes
echo "Step 1: Generating synthetic data for 3 sites..."
IFS=',' read -ra SIZES <<< "$SITE_SIZES"
for i in 0 1 2; do
  SITE_ID=$((i + 1))
  SIZE=${SIZES[$i]}
  
  echo "  Site $SITE_ID: $SIZE patients..."
  npx harmonia causal generate-omop-data \
    --scenario diabetes \
    --n "$SIZE" \
    --true-ate 0.15 \
    --confounding 0.3 \
    --treatment-rate 0.5 \
    --seed $((42 + i)) \
    --output "$SCALE_DIR/site-$SITE_ID.json" \
    > /dev/null 2>&1
done

echo "✅ Data generation complete"
echo

# Step 2: Compute site-specific bounds
echo "Step 2: Computing site-specific bounds..."
for SITE_ID in 1 2 3; do
  echo "  Site $SITE_ID..."
  npx harmonia causal compute-bounds \
    --data "$SCALE_DIR/site-$SITE_ID.json" \
    --assumption mtr \
    --output "$SCALE_DIR/site-$SITE_ID-bounds.json" \
    > /dev/null 2>&1
done

echo "✅ Bounds computation complete"
echo

# Step 3: Compute E-values and FRI for each site
echo "Step 3: Computing E-values for each site..."
SITE_EVALUES=""
for SITE_ID in 1 2 3; do
  echo "  Site $SITE_ID..."
  
  # Read bounds
  BOUNDS=$(cat "$SCALE_DIR/site-$SITE_ID-bounds.json")
  LOWER=$(echo "$BOUNDS" | grep -o '"lower":[^,]*' | cut -d: -f2)
  UPPER=$(echo "$BOUNDS" | grep -o '"upper":[^,]*' | cut -d: -f2)
  SAMPLE_SIZE=$(echo "$BOUNDS" | grep -o '"sampleSize":[^,}]*' | cut -d: -f2)
  
  # Compute E-value from bounds (using upper bound, conservative)
  # E-value = RR + sqrt(RR*(RR-1)) where RR = exp(|ATE|)
  # We'll use a Node.js one-liner to compute this
  EVALUE=$(node -e "
    const lower = $LOWER;
    const upper = $UPPER;
    const baseline = 0.4;
    
    // Use upper bound (conservative) to compute RR
    const ate = Math.abs(upper);
    const rr = ate === 0 ? 1 : Math.exp(ate);
    const evalue = rr + Math.sqrt(rr * (rr - 1));
    
    console.log(evalue.toFixed(3));
  ")
  
  # Store site E-value
  cat > "$SCALE_DIR/site-$SITE_ID-evalue.json" << EOF
{
  "site_id": "site-$SITE_ID",
  "evalue": $EVALUE,
  "sample_size": $SAMPLE_SIZE,
  "lower": $LOWER,
  "upper": $UPPER
}
EOF

  if [ -z "$SITE_EVALUES" ]; then
    SITE_EVALUES="$SCALE_DIR/site-$SITE_ID-evalue.json"
  else
    SITE_EVALUES="$SITE_EVALUES,$SCALE_DIR/site-$SITE_ID-evalue.json"
  fi
done

echo "✅ E-value computation complete"
echo

# Step 4: Aggregate E-values using different strategies
echo "Step 4: Aggregating E-values using FRI..."

# Create combined JSON array for Node.js processing
COMBINED_JSON="["
FIRST=true
for SITE_ID in 1 2 3; do
  if [ "$FIRST" = false ]; then
    COMBINED_JSON="$COMBINED_JSON,"
  fi
  COMBINED_JSON="$COMBINED_JSON$(cat "$SCALE_DIR/site-$SITE_ID-evalue.json")"
  FIRST=false
done
COMBINED_JSON="$COMBINED_JSON]"

# Compute FRI for all three strategies
node -e "
const siteEvalues = $COMBINED_JSON;

// Import computation functions (simplified inline versions)
function computeWeights(sampleSizes, strategy) {
  let unnormalized;
  
  switch (strategy) {
    case 'sample-size':
      unnormalized = sampleSizes;
      break;
    case 'equal':
      unnormalized = sampleSizes.map(() => 1);
      break;
    case 'conservative':
      // Not used for weights, but we'll handle it separately
      return null;
    default:
      throw new Error(\`Unknown strategy: \${strategy}\`);
  }
  
  const sum = unnormalized.reduce((a, b) => a + b, 0);
  return unnormalized.map((w) => w / sum);
}

function computeFRI(siteEvalues, strategy) {
  const evalues = siteEvalues.map(s => s.evalue);
  const sampleSizes = siteEvalues.map(s => s.sample_size);
  const totalN = sampleSizes.reduce((sum, n) => sum + n, 0);
  
  let aggregated_evalue;
  
  if (strategy === 'conservative') {
    // Conservative: take minimum E-value
    aggregated_evalue = Math.min(...evalues);
  } else {
    // Weighted average
    const weights = computeWeights(sampleSizes, strategy);
    aggregated_evalue = evalues.reduce((sum, e, i) => sum + e * weights[i], 0);
  }
  
  // Compute heterogeneity (CV)
  const mean = evalues.reduce((sum, e) => sum + e, 0) / evalues.length;
  const variance = evalues.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / evalues.length;
  const std = Math.sqrt(variance);
  const cv = (std / mean) * 100;
  
  return {
    strategy,
    aggregated_evalue: aggregated_evalue.toFixed(3),
    min_evalue: Math.min(...evalues).toFixed(3),
    max_evalue: Math.max(...evalues).toFixed(3),
    cv: cv.toFixed(2),
    total_sample_size: totalN,
    num_sites: siteEvalues.length
  };
}

const strategies = ['sample-size', 'equal', 'conservative'];
const results = {};

for (const strategy of strategies) {
  results[strategy] = computeFRI(siteEvalues, strategy);
}

// Save results
const fs = require('fs');
fs.writeFileSync('$SCALE_DIR/aggregated-results.json', JSON.stringify({
  scale: '$SCALE',
  total_patients: $NUM_PATIENTS,
  num_sites: 3,
  site_evalues: siteEvalues,
  aggregation_results: results
}, null, 2));

console.log(JSON.stringify(results, null, 2));
" > "$SCALE_DIR/aggregation-summary.txt"

echo "✅ FRI aggregation complete"
echo

# Step 5: Generate comparison table
echo "Step 5: Generating comparison table..."

cat > "$SCALE_DIR/comparison.md" << 'EOF_MARKER'
# Federated E-values Comparison

## Scale: SCALE_PLACEHOLDER

| Strategy | Aggregated E-value | Min E-value | Max E-value | CV (%) | Total N | Sites |
|----------|-------------------|-------------|-------------|--------|---------|-------|
EOF_MARKER

node -e "
const fs = require('fs');
const results = JSON.parse(fs.readFileSync('$SCALE_DIR/aggregated-results.json', 'utf8'));

const strategyNames = {
  'sample-size': 'Sample-size (FRI)',
  'equal': 'Equal-weight',
  'conservative': 'Conservative'
};

for (const [key, result] of Object.entries(results.aggregation_results)) {
  const name = strategyNames[key] || key;
  console.log(\`| \${name} | \${result.aggregated_evalue} | \${result.min_evalue} | \${result.max_evalue} | \${result.cv}% | \${result.total_sample_size.toLocaleString()} | \${result.num_sites} |\`);
}
" >> "$SCALE_DIR/comparison.md"

sed -i "s/SCALE_PLACEHOLDER/$SCALE ($NUM_PATIENTS patients)/" "$SCALE_DIR/comparison.md"

echo "✅ Comparison table generated"
echo

# Step 6: Communication cost analysis
echo "Step 6: Computing communication cost..."

# 58 bytes per site: site_id (20) + evalue (8) + sample_size (4) + metadata (26)
BYTES_PER_SITE=58
TOTAL_BYTES=$((BYTES_PER_SITE * 3))

cat >> "$SCALE_DIR/comparison.md" << EOF

## Communication Cost

- **Bytes per site**: $BYTES_PER_SITE bytes
- **Total communication**: $TOTAL_BYTES bytes (3 sites)
- **Data transmitted**: Site ID, E-value, sample size, metadata

### Breakdown per site:
- Site ID: 20 bytes
- E-value: 8 bytes (double)
- Sample size: 4 bytes (int)
- Metadata: 26 bytes (interpretation + robustness level)

### Comparison to centralized approach:

EOF

# Calculate data reduction
if [ "$SCALE" = "1k" ]; then
  CENTRALIZED_KB=201
  CENTRALIZED_BYTES=$((CENTRALIZED_KB * 1024))
elif [ "$SCALE" = "100k" ]; then
  CENTRALIZED_MB=41.9
  CENTRALIZED_BYTES=$(echo "$CENTRALIZED_MB * 1024 * 1024" | bc | cut -d. -f1)
elif [ "$SCALE" = "2.8m" ]; then
  CENTRALIZED_MB=482
  CENTRALIZED_BYTES=$((CENTRALIZED_MB * 1024 * 1024))
fi

REDUCTION_FACTOR=$((CENTRALIZED_BYTES / TOTAL_BYTES))

cat >> "$SCALE_DIR/comparison.md" << EOF
- Centralized approach: $(numfmt --to=iec-i --suffix=B $CENTRALIZED_BYTES)
- Federated approach: $TOTAL_BYTES bytes
- **Reduction factor**: ${REDUCTION_FACTOR}× reduction

EOF

echo "✅ Communication cost analysis complete"
echo

echo "========================================" 
echo "✅ Experiment complete!"
echo "========================================" 
echo
echo "Results saved to: $SCALE_DIR/"
echo "  - aggregated-results.json: Full results"
echo "  - comparison.md: Formatted comparison table"
echo "  - site-*-evalue.json: Site-specific E-values"
echo
echo "View results:"
echo "  cat $SCALE_DIR/comparison.md"
echo
