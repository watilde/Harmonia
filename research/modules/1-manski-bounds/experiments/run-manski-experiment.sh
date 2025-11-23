#!/bin/bash
# Manski Bounds Experiment Runner
# Runs federated Manski bounds experiments with different scenarios

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
SCENARIO="${1:-diabetes}"
NUM_PATIENTS="${2:-1000}"
NUM_SITES="${3:-3}"

# Scenario configurations
case "$SCENARIO" in
  diabetes)
    TITLE="Diabetes Medication Effectiveness Study"
    ;;
  icu)
    TITLE="ICU Early Intervention Study"
    NUM_PATIENTS="${2:-3200}"
    NUM_SITES="${3:-4}"
    ;;
  screening)
    TITLE="Preventive Screening Study"
    NUM_PATIENTS="${2:-6000}"
    NUM_SITES="${3:-5}"
    ;;
  *)
    echo "Usage: $0 [diabetes|icu|screening] [num_patients] [num_sites]"
    echo
    echo "Examples:"
    echo "  $0 diabetes 1000 3    # Diabetes study, 1000 patients, 3 sites"
    echo "  $0 icu 3200 4         # ICU study, 3200 patients, 4 sites"
    echo "  $0 screening 6000 5   # Screening study, 6000 patients, 5 sites"
    exit 1
    ;;
esac

OUTPUT_DIR="$SCRIPT_DIR/output/$SCENARIO"

echo "========================================"
echo "$TITLE"
echo "========================================"
echo "Scenario: $SCENARIO"
echo "Patients: $NUM_PATIENTS"
echo "Sites: $NUM_SITES"
echo

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Step 1: Generate synthetic OMOP data..."
npx harmonia causal generate-omop-data \
  --scenario "$SCENARIO" \
  --n "$NUM_PATIENTS" \
  --output "$OUTPUT_DIR/data.json"

echo
echo "Step 2: Split data into $NUM_SITES sites..."
npx harmonia causal split-data \
  --input "$OUTPUT_DIR/data.json" \
  --num-sites "$NUM_SITES" \
  --output "$OUTPUT_DIR/sites"

echo
echo "Step 3: Compute Manski bounds for each site..."
for ((site=1; site<=NUM_SITES; site++)); do
  echo "  Site $site..."
  npx harmonia causal compute-bounds \
    --data "$OUTPUT_DIR/sites/site-$site.json" \
    --assumption worst-case \
    --output "$OUTPUT_DIR/site-$site-worst-case.json"
  
  npx harmonia causal compute-bounds \
    --data "$OUTPUT_DIR/sites/site-$site.json" \
    --assumption mtr \
    --output "$OUTPUT_DIR/site-$site-mtr.json"
done

echo
echo "Step 4: Aggregate bounds across sites..."
npx harmonia causal aggregate-bounds \
  --bounds "$OUTPUT_DIR"/site-*-mtr.json \
  --strategy sample-size \
  --output "$OUTPUT_DIR/aggregated.json"

echo
echo "✅ Experiment complete!"
echo "📊 Results: $OUTPUT_DIR"
