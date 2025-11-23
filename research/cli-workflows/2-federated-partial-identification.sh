#!/bin/bash
##############################################################################
# Federated Partial Identification Workflow
# 
# Demonstrates optimal weighting strategies for federated causal bounds
# Based on research paper: "Federated Partial Identification with 
# Optimal Weighting Strategies"
#
# Uses real OMOP data (Synthea 1k by default)
#
# Usage:
#   ./2-federated-partial-identification.sh [dataset]
#   dataset: 1k (default), 100k, 2.8m, or mimic-demo
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Parse dataset argument (default: 1k)
DATASET="${1:-1k}"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/output/federated-partial-id-$DATASET"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  📊 Federated Partial Identification - $DATASET Dataset"
echo "════════════════════════════════════════════════════════════════════"
echo ""

##############################################################################
# Load Real Data
##############################################################################
print_section_header "Loading Real OMOP Data"

if [ "$DATASET" = "mimic-demo" ]; then
  echo "  Loading MIMIC test data (single site)..."
  if ! load_mimic_data "$DATA_DIR"; then
    print_error "Failed to load MIMIC data"
    exit 1
  fi
  
  echo ""
  get_mimic_data_size "$DATA_DIR"
  
  IS_FEDERATED=false
else
  echo "  Loading Synthea $DATASET split data (3 sites)..."
  if ! load_split_data "$DATASET" "$DATA_DIR" "site" 3; then
    print_error "Failed to load $DATASET data"
    exit 1
  fi
  
  echo ""
  get_split_data_sizes "$DATA_DIR" "site" 3
  
  IS_FEDERATED=true
fi

print_success "Data loaded"
echo ""

##############################################################################
# Compute MTR Bounds
##############################################################################
print_section_header "Computing MTR Bounds"

if [ "$IS_FEDERATED" = false ]; then
  # MIMIC: single test site
  echo "  Computing bounds for MIMIC test data..."
  compute_site_bounds \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-bounds.json" \
    "mtr"
  
  cp "$DATA_DIR/mimic-bounds.json" "$OUTPUT_DIR/mimic-demo_single-site.json"
  
  print_success "Bounds computed"
  echo ""
  
  print_section_header "Summary"
  echo "  MIMIC test dataset: Single site (no federation)"
  echo "  Results saved to: $OUTPUT_DIR"
  echo ""
  jq -r '"  Bounds: [\(.lower | tostring | .[0:6]), \(.upper | tostring | .[0:6])], width=\(.width | tostring | .[0:6])"' \
    "$DATA_DIR/mimic-bounds.json"
  echo ""
  print_success "Workflow Complete"
  exit 0
fi

# Synthea: compute bounds at each site
echo "  Computing MTR bounds at each site..."
for i in {1..3}; do
  compute_site_bounds \
    "$DATA_DIR/site-${i}-data.json" \
    "$DATA_DIR/site-${i}-bounds.json" \
    "mtr"
done

print_success "Bounds computed"
echo ""

##############################################################################
# Compare Aggregation Strategies
##############################################################################
print_section_header "Comparing Aggregation Strategies"

compare_aggregation_strategies "$OUTPUT_DIR" "$DATASET" \
  "$DATA_DIR/site-1-bounds.json" \
  "$DATA_DIR/site-2-bounds.json" \
  "$DATA_DIR/site-3-bounds.json"

print_success "Strategy comparison complete"
echo ""

##############################################################################
# Display Site-Level Bounds
##############################################################################
print_section_header "Site-Level Bounds"

echo "  Individual site results:"
for i in {1..3}; do
  echo ""
  printf "    Site %d: " "$i"
  jq -r '"[\(.lower | tostring | .[0:6]), \(.upper | tostring | .[0:6])], width=\(.width | tostring | .[0:6])"' \
    "$DATA_DIR/site-${i}-bounds.json"
done

echo ""
echo ""

##############################################################################
# Display Federated Results
##############################################################################
print_section_header "Federated Results"

echo "  Aggregation strategies:"
echo ""

strategies=("weighted-average" "inverse-width" "conservative" "uniform")
for strategy in "${strategies[@]}"; do
  result_file="$OUTPUT_DIR/${DATASET}_${strategy}.json"
  if [ -f "$result_file" ]; then
    printf "    %-18s: " "$strategy"
    jq -r '"[\(.lower | tostring | .[0:6]), \(.upper | tostring | .[0:6])], width=\(.width | tostring | .[0:6])"' \
      "$result_file"
  fi
done

echo ""
echo ""

##############################################################################
# Compare Strategy Performance
##############################################################################
print_section_header "Strategy Performance Analysis"

# Find best (tightest) and worst (widest) strategies
echo "  Width comparison:"
echo ""

best_width=999
worst_width=0
best_strategy=""
worst_strategy=""

for strategy in "${strategies[@]}"; do
  result_file="$OUTPUT_DIR/${DATASET}_${strategy}.json"
  if [ -f "$result_file" ]; then
    width=$(jq -r '.width' "$result_file")
    printf "    %-18s: width = %s\n" "$strategy" "$(echo $width | cut -c1-6)"
    
    # Track best and worst (using bc for float comparison)
    if (( $(echo "$width < $best_width" | bc -l) )); then
      best_width=$width
      best_strategy=$strategy
    fi
    if (( $(echo "$width > $worst_width" | bc -l) )); then
      worst_width=$width
      worst_strategy=$strategy
    fi
  fi
done

echo ""
echo "  Key findings:"
echo "    • Tightest bounds: $best_strategy (width=$(echo $best_width | cut -c1-6))"
echo "    • Widest bounds:   $worst_strategy (width=$(echo $worst_width | cut -c1-6))"

if [ "$best_strategy" != "$worst_strategy" ]; then
  improvement=$(echo "scale=4; (($worst_width - $best_width) / $worst_width) * 100" | bc)
  echo "    • Improvement: ${improvement:0:4}% tighter with $best_strategy vs $worst_strategy"
fi

echo ""
echo ""

##############################################################################
# Summary
##############################################################################
print_section_header "Summary"

echo "  Dataset: Synthea $DATASET (3 federated sites)"
echo "  Results saved to: $OUTPUT_DIR"
echo ""
echo "  Research findings:"
echo "    • Inverse-width weighting typically minimizes bound width"
echo "    • Conservative strategy sacrifices width for safety"
echo "    • Weighted-average balances site contributions by sample size"
echo ""
print_success "Federated Partial Identification Workflow Complete"
echo ""
