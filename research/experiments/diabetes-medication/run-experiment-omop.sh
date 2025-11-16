#!/bin/bash
#
# Diabetes Medication Effectiveness Study - OMOP Data Analysis
# 
# Scenario: Compare new diabetes drug vs standard of care
# Outcome: HbA1c < 7% within 6 months (binary)
# Data: OMOP CDM-based synthetic patient data
# Confounders: Age, BMI, baseline HbA1c, comorbidities
#
# This version uses OMOP-generated data instead of simple synthetic data.
# It tests ALL FOUR assumption levels to demonstrate the
# informativeness vs. coverage trade-off with realistic EHR data.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output-omop"
PROJECT_ROOT="/home/user/webapp"
CLI="node $PROJECT_ROOT/packages/cli/dist/cli.js"
OMOP_DATA_DIR="$SCRIPT_DIR/data/omop"

# Configuration
NUM_SITES=3
ASSUMPTIONS=("worst-case" "mtr" "mts" "mtr-mts")

echo "=========================================================="
echo "Diabetes Medication Effectiveness Study"
echo "Multi-Assumption Analysis with OMOP Data"
echo "=========================================================="
echo ""
echo "Configuration:"
echo "  Data source:  OMOP CDM synthetic patients"
echo "  Sites:        $NUM_SITES"
echo "  Assumptions:  All 4 levels (worst-case, MTR, MTS, MTR+MTS)"
echo ""

# Check if OMOP data exists
if [ ! -d "$OMOP_DATA_DIR" ]; then
  echo "❌ Error: OMOP data not found at $OMOP_DATA_DIR"
  echo "   Please run data generation first:"
  echo "   1. Generate data: python3 research/causal-inference/data-generation/synthea/generate-omop-data.py --scenario diabetes --n-patients 1000"
  echo "   2. Split data: python3 research/causal-inference/data-generation/split-omop-data.py --input output/diabetes/causal-data.json --output-dir $OMOP_DATA_DIR --num-sites 3"
  exit 1
fi

# Clean previous results
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/bounds" "$OUTPUT_DIR/results"

# Create subdirectories for each assumption
for assumption in "${ASSUMPTIONS[@]}"; do
  mkdir -p "$OUTPUT_DIR/bounds/$assumption"
  mkdir -p "$OUTPUT_DIR/results/$assumption"
done

################################################################################
# Step 1: Verify OMOP data exists for each site
################################################################################
echo "Step 1: Verifying OMOP data for $NUM_SITES hospitals..."
echo "──────────────────────────────────────────────────────────"
for site in $(seq 1 $NUM_SITES); do
  if [ ! -f "$OMOP_DATA_DIR/site${site}.json" ]; then
    echo "❌ Error: Missing data for site $site"
    exit 1
  fi
  
  # Extract site metadata using Python
  METADATA=$(python3 << PYTHON_EOF
import json
with open("$OMOP_DATA_DIR/site${site}.json") as f:
    data = json.load(f)
    meta = data['metadata']
    print(f"{meta['n_patients']}|{meta['n_treated']}|{meta['n_control']}")
PYTHON_EOF
)
  
  IFS='|' read -r n_patients n_treated n_control <<< "$METADATA"
  echo "  Site $site: $n_patients patients ($n_treated treated, $n_control control)"
done
echo ""

################################################################################
# Step 2: Compute local bounds at each site for EACH assumption
################################################################################
echo "Step 2: Computing local bounds under all assumptions..."
echo "──────────────────────────────────────────────────────────"

for assumption in "${ASSUMPTIONS[@]}"; do
  echo ""
  echo "  Assumption: $assumption"
  echo "  ─────────────────────────────"
  
  for site in $(seq 1 $NUM_SITES); do
    echo "    Site $site: Hospital-$site"
    
    # Extract patient data array from OMOP site file
    python3 << PYTHON_EOF > "$OUTPUT_DIR/bounds/$assumption/site${site}-data.json"
import json
with open("$OMOP_DATA_DIR/site${site}.json") as f:
    data = json.load(f)
    # Extract just the patients array for CLI compatibility
    print(json.dumps(data['patients'], indent=2))
PYTHON_EOF
    
    $CLI causal compute-bounds \
      -d "$OUTPUT_DIR/bounds/$assumption/site${site}-data.json" \
      -o "$OUTPUT_DIR/bounds/$assumption/site${site}-bounds.json" \
      -a $assumption \
      --site-id "Hospital-$site" \
      2>&1 | grep -E "Lower bound|Upper bound|Width:" | sed 's/^/      /'
  done
done

echo ""

################################################################################
# Step 3: Federate bounds for EACH assumption
################################################################################
echo "Step 3: Federating bounds under all assumptions..."
echo "──────────────────────────────────────────────────────────"

for assumption in "${ASSUMPTIONS[@]}"; do
  echo ""
  echo "  Assumption: $assumption"
  echo "  ─────────────────────────────"
  
  # Collect all local bound files
  BOUND_FILES=""
  for site in $(seq 1 $NUM_SITES); do
    BOUND_FILES="$BOUND_FILES $OUTPUT_DIR/bounds/$assumption/site${site}-bounds.json"
  done
  
  $CLI causal federate-bounds \
    -s $BOUND_FILES \
    -o "$OUTPUT_DIR/results/$assumption/federated.json" \
    --strategy weighted-average \
    2>&1 | grep -E "strategy|Federated lower|Federated upper|Federated width" | sed 's/^/    /'
done

echo ""

################################################################################
# Step 4: Generate comparison report
################################################################################
echo "Step 4: Generating comparison report..."
echo "──────────────────────────────────────────────────────────"

# Create comparison table
cat > "$OUTPUT_DIR/comparison.txt" << 'EOF'
========================================================================
Diabetes Study - OMOP Data - Assumption Comparison
========================================================================

Assumption    Lower Bound   Upper Bound   Width      Notes
------------------------------------------------------------------------
EOF

for assumption in "${ASSUMPTIONS[@]}"; do
  # Extract bounds using Python
  RESULT=$(python3 << PYTHON_EOF
import json
with open("$OUTPUT_DIR/results/$assumption/federated.json") as f:
    data = json.load(f)
print(f"{data['lower']:.4f}|{data['upper']:.4f}|{data['width']:.4f}")
PYTHON_EOF
)
  
  IFS='|' read -r lower upper width <<< "$RESULT"
  
  # Determine notes
  case $assumption in
    "worst-case")
      notes="Widest, always valid"
      ;;
    "mtr")
      notes="Assumes treatment doesn't harm"
      ;;
    "mts")
      notes="Accounts for confounding-by-indication"
      ;;
    "mtr-mts")
      notes="Tightest, both assumptions"
      ;;
  esac
  
  printf "%-12s  %+.4f      %+.4f      %.4f     %s\n" \
    "$assumption" "$lower" "$upper" "$width" "$notes" >> "$OUTPUT_DIR/comparison.txt"
done

cat >> "$OUTPUT_DIR/comparison.txt" << 'EOF'
------------------------------------------------------------------------

Interpretation:
- OMOP data reflects realistic EHR patterns with confounding-by-indication
- MTS assumption is most appropriate for observational healthcare data
- Width measures informativeness (smaller = more informative)
- All bounds should contain true causal effect for valid inference

Note: This analysis uses OMOP CDM-structured synthetic patient data
      generated with realistic clinical confounding patterns.
========================================================================
EOF

cat "$OUTPUT_DIR/comparison.txt"
echo ""

echo "✅ Analysis complete!"
echo ""
echo "Results saved to: $OUTPUT_DIR"
echo "  - bounds/$assumption/       : Local bounds per site"
echo "  - results/$assumption/      : Federated results"
echo "  - comparison.txt            : Summary comparison"
echo ""
