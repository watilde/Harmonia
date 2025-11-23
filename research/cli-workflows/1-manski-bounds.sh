#!/bin/bash
##############################################################################
# Manski Bounds CLI Workflow
# 
# This script demonstrates the complete Manski bounds workflow using real data.
#
# Workflow:
# 1. Load real OMOP data (Synthea 1k split into 3 sites by default)
# 2. Compute bounds at each site (worst-case and MTR)
# 3. Federate bounds using different aggregation strategies
# 4. Compare results
#
# Usage:
#   ./1-manski-bounds.sh [dataset]
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
OUTPUT_DIR="$SCRIPT_DIR/output/manski-bounds-$DATASET"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🏥 Federated Manski Bounds Workflow - $DATASET Dataset"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "This workflow demonstrates partial identification in federated settings"
echo "using real OMOP data."
echo ""

##############################################################################
# Step 1: Load Real Data
##############################################################################
print_section_header "Step 1: Loading Real OMOP Data"

if [ "$DATASET" = "mimic-demo" ]; then
  echo "  Loading MIMIC test data (single site)..."
  if ! load_mimic_data "$DATA_DIR"; then
    print_error "Failed to load MIMIC data"
    echo ""
    echo "Please download MIMIC data first:"
    echo "  cd research && npm run data:download:mimic"
    exit 1
  fi
  
  echo ""
  echo "  Sample size:"
  get_mimic_data_size "$DATA_DIR"
  
  IS_FEDERATED=false
else
  echo "  Loading Synthea $DATASET split data (3 federated sites)..."
  if ! load_split_data "$DATASET" "$DATA_DIR" "site" 3; then
    print_error "Failed to load $DATASET data"
    echo ""
    echo "Please download and split data first:"
    echo "  cd research"
    echo "  npm run data:download:$DATASET"
    echo "  npm run data:split:$DATASET"
    exit 1
  fi
  
  echo ""
  echo "  Sample sizes:"
  get_split_data_sizes "$DATA_DIR" "site" 3
  
  IS_FEDERATED=true
fi

print_success "Data loaded successfully"
echo ""

##############################################################################
# Step 2: Compute Bounds
##############################################################################
print_section_header "Step 2: Computing Manski Bounds"

if [ "$IS_FEDERATED" = false ]; then
  # MIMIC: single site
  echo "  Computing bounds for MIMIC test data..."
  
  compute_site_bounds \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-worst-case.json" \
    "worst-case"
  
  compute_site_bounds \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-mtr.json" \
    "mtr"
  
  echo "    ✓ Worst-case and MTR bounds computed"
  
  # Copy to output for consistency
  cp "$DATA_DIR/mimic-mtr.json" "$OUTPUT_DIR/mimic-demo_single-site.json"
  
else
  # Synthea: 3 federated sites
  echo "  Computing bounds at each site..."
  
  for i in {1..3}; do
    echo "    Site $i..."
    
    compute_site_bounds \
      "$DATA_DIR/site-${i}-data.json" \
      "$DATA_DIR/site-${i}-worst-case.json" \
      "worst-case"
    
    compute_site_bounds \
      "$DATA_DIR/site-${i}-data.json" \
      "$DATA_DIR/site-${i}-mtr.json" \
      "mtr"
  done
fi

print_success "Bounds computed"
echo ""

##############################################################################
# Step 3: Federate Bounds (Synthea only)
##############################################################################
if [ "$IS_FEDERATED" = true ]; then
  print_section_header "Step 3: Federating Bounds"
  
  echo "  Comparing aggregation strategies..."
  echo ""
  
  strategies=("weighted-average" "inverse-width" "conservative" "uniform")
  
  for strategy in "${strategies[@]}"; do
    echo "    Strategy: $strategy"
    
    # Worst-case federated
    federate_bounds_with_strategy "$strategy" \
      "$OUTPUT_DIR/federated-worst-case-${strategy}.json" \
      "$DATA_DIR/site-1-worst-case.json" \
      "$DATA_DIR/site-2-worst-case.json" \
      "$DATA_DIR/site-3-worst-case.json"
    
    # MTR federated
    federate_bounds_with_strategy "$strategy" \
      "$OUTPUT_DIR/federated-mtr-${strategy}.json" \
      "$DATA_DIR/site-1-mtr.json" \
      "$DATA_DIR/site-2-mtr.json" \
      "$DATA_DIR/site-3-mtr.json"
  done
  
  print_success "Federation complete"
  echo ""
fi

##############################################################################
# Step 4: Display Results
##############################################################################
print_section_header "Results Summary"

if [ "$IS_FEDERATED" = false ]; then
  # MIMIC results
  echo "  MIMIC Test Dataset Results:"
  echo ""
  echo "  Worst-Case Bounds:"
  jq -r '  "    Lower: \(.lower | tostring | .[0:6])  Upper: \(.upper | tostring | .[0:6])  Width: \(.width | tostring | .[0:6])"' \
    "$DATA_DIR/mimic-worst-case.json"
  
  echo ""
  echo "  MTR Bounds:"
  jq -r '  "    Lower: \(.lower | tostring | .[0:6])  Upper: \(.upper | tostring | .[0:6])  Width: \(.width | tostring | .[0:6])"' \
    "$DATA_DIR/mimic-mtr.json"
  
else
  # Synthea federated results
  echo "  Worst-Case Bounds (Federated):"
  echo "  ────────────────────────────────────────"
  for strategy in "${strategies[@]}"; do
    echo ""
    printf "    %-18s: " "$strategy"
    jq -r '"[\(.lower | tostring | .[0:6]), \(.upper | tostring | .[0:6])], width=\(.width | tostring | .[0:6])"' \
      "$OUTPUT_DIR/federated-worst-case-${strategy}.json"
  done
  
  echo ""
  echo ""
  echo "  MTR Bounds (Federated):"
  echo "  ────────────────────────────────────────"
  for strategy in "${strategies[@]}"; do
    echo ""
    printf "    %-18s: " "$strategy"
    jq -r '"[\(.lower | tostring | .[0:6]), \(.upper | tostring | .[0:6])], width=\(.width | tostring | .[0:6])"' \
      "$OUTPUT_DIR/federated-mtr-${strategy}.json"
  done
fi

echo ""
echo ""
print_success "Workflow Complete"
echo ""
echo "  Output directory: $OUTPUT_DIR"
echo ""

if [ "$IS_FEDERATED" = true ]; then
  echo "  Key findings:"
  echo "    • MTR bounds are tighter than worst-case (smaller width)"
  echo "    • Inverse-width strategy minimizes bound width"
  echo "    • Conservative strategy provides safety at cost of width"
else
  echo "  MIMIC test dataset provides external validation"
  echo "  Single site results (no federation)"
fi

echo ""
