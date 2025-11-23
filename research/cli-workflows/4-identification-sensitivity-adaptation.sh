#!/bin/bash
##############################################################################
# Identification-Sensitivity-Adaptation Complete Pipeline Workflow
# 
# Comprehensive hierarchical federated causal inference pipeline integrating
# all three research modules:
# 1. Identification: Federated Partial Identification (optimal weighting)
# 2. Sensitivity: Federated E-values & Robustness Index
# 3. Adaptation: Design-Failure-Aware Causal Inference (automatic adaptation)
#
# Uses real OMOP data (Synthea 1k by default)
#
# Usage:
#   ./4-identification-sensitivity-adaptation.sh [dataset]
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
OUTPUT_DIR="$SCRIPT_DIR/output/identification-sensitivity-adaptation-$DATASET"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🚀 Hierarchical Framework Pipeline - $DATASET Dataset"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "  Identification → Sensitivity → Adaptation"
echo ""

##############################################################################
# Load Real Data
##############################################################################
print_section_header "Loading Real OMOP Data"

if [ "$DATASET" = "mimic-demo" ]; then
  echo "  Loading MIMIC test data..."
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
# MODULE 3: Design-Failure-Aware - Assumption Diagnostics
##############################################################################
print_section_header "Module 3: Assumption Diagnostics"

if [ "$IS_FEDERATED" = false ]; then
  echo "  Running diagnostic tests on MIMIC data..."
  diagnose_site_assumptions \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-diagnostics.json"
  
  display_assumption_scores "$DATA_DIR/mimic-diagnostics.json" "MIMIC"
  
else
  echo "  Running diagnostic tests at each site..."
  for i in {1..3}; do
    diagnose_site_assumptions \
      "$DATA_DIR/site-${i}-data.json" \
      "$DATA_DIR/site-${i}-diagnostics.json"
  done
  
  echo ""
  echo -e "${BLUE}Diagnostic scores by site:${NC}"
  for i in {1..3}; do
    display_assumption_scores "$DATA_DIR/site-${i}-diagnostics.json" "Site $i"
  done
fi

print_success "Diagnostics complete"
echo ""

##############################################################################
# MODULE 3: Automatic Inference Mode Selection
##############################################################################
print_section_header "Module 3: Inference Mode Selection"

if [ "$IS_FEDERATED" = false ]; then
  echo "  Selecting mode for MIMIC test data..."
  select_site_mode "$DATA_DIR/mimic-diagnostics.json" "$DATA_DIR/mimic-mode.json"
  display_selected_mode "$DATA_DIR/mimic-mode.json" "MIMIC"
  
else
  echo "  Selecting inference mode for each site..."
  for i in {1..3}; do
    select_site_mode \
      "$DATA_DIR/site-${i}-diagnostics.json" \
      "$DATA_DIR/site-${i}-mode.json"
  done
  
  echo ""
  echo -e "${BLUE}Selected modes:${NC}"
  for i in {1..3}; do
    display_selected_mode "$DATA_DIR/site-${i}-mode.json" "Site $i"
  done
fi

print_success "Modes selected"
echo ""

##############################################################################
# MODULE 1: Federated Partial Identification
##############################################################################
print_section_header "Module 1: Partial Identification"

if [ "$IS_FEDERATED" = false ]; then
  echo "  Computing bounds for MIMIC test data..."
  compute_site_bounds \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-bounds.json" \
    "mtr"
  
  cp "$DATA_DIR/mimic-bounds.json" "$OUTPUT_DIR/mimic-results.json"
  
else
  echo "  Computing MTR bounds at each site..."
  for i in {1..3}; do
    compute_site_bounds \
      "$DATA_DIR/site-${i}-data.json" \
      "$DATA_DIR/site-${i}-bounds.json" \
      "mtr"
  done
  
  echo ""
  echo "  Federating with optimal strategy (inverse-width)..."
  federate_bounds_with_strategy "inverse-width" \
    "$OUTPUT_DIR/federated-bounds.json" \
    "$DATA_DIR/site-1-bounds.json" \
    "$DATA_DIR/site-2-bounds.json" \
    "$DATA_DIR/site-3-bounds.json"
fi

print_success "Partial identification complete"
echo ""

##############################################################################
# MODULE 2: Federated E-values & Robustness Index
##############################################################################
print_section_header "Module 2: Sensitivity Analysis"

if [ "$IS_FEDERATED" = false ]; then
  echo "  Computing E-value for MIMIC test data..."
  compute_evalue_from_bounds \
    "$DATA_DIR/mimic-bounds.json" \
    0.4 \
    "$DATA_DIR/mimic-evalue.json"
  
else
  echo "  Computing E-values at each site..."
  for i in {1..3}; do
    compute_evalue_from_bounds \
      "$DATA_DIR/site-${i}-bounds.json" \
      0.4 \
      "$DATA_DIR/site-${i}-evalue.json"
  done
  
  echo ""
  echo "  Computing Federated Robustness Index..."
  
  # Create multi-site evalues JSON in the format expected by compute-fri
  echo "[" > "$DATA_DIR/multi-site-evalues.json"
  
  first=true
  for i in {1..3}; do
    if [[ "$first" == false ]]; then
      echo "  ," >> "$DATA_DIR/multi-site-evalues.json"
    fi
    first=false
    
    # Extract E-value, sample size, and robustness level
    evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/site-${i}-evalue.json")
    robustness=$(jq -r '.conservative.robustness_level' "$DATA_DIR/site-${i}-evalue.json")
    interpretation=$(jq -r '.conservative.interpretation' "$DATA_DIR/site-${i}-evalue.json")
    sample_size=$(jq -r '.sampleSize' "$DATA_DIR/site-${i}-bounds.json")
    
    # Create SiteEvalue object
    cat >> "$DATA_DIR/multi-site-evalues.json" <<EOF
  {
    "site_id": "site-${i}",
    "evalue": $evalue,
    "sample_size": $sample_size,
    "robustness_level": "$robustness",
    "interpretation": "$interpretation"
  }
EOF
  done
  
  echo "" >> "$DATA_DIR/multi-site-evalues.json"
  echo "]" >> "$DATA_DIR/multi-site-evalues.json"
  
  compute_fri "$DATA_DIR/multi-site-evalues.json" "sample-size" "$OUTPUT_DIR/fri-results.json"
fi

print_success "Sensitivity analysis complete"
echo ""

##############################################################################
# Integrated Results Summary
##############################################################################
print_section_header "Integrated Pipeline Results"

if [ "$IS_FEDERATED" = false ]; then
  # MIMIC results
  echo "  MIMIC Test Dataset:"
  echo ""
  
  evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/mimic-evalue.json")
  lower=$(jq -r '.bounds.lower' "$DATA_DIR/mimic-bounds.json")
  upper=$(jq -r '.bounds.upper' "$DATA_DIR/mimic-bounds.json")
  width=$(jq -r '.width' "$DATA_DIR/mimic-bounds.json")
  
  echo "    Bounds: [$(printf '%.4f' $lower), $(printf '%.4f' $upper)], width=$(printf '%.4f' $width)"
  echo "    E-value: $(printf '%.2f' $evalue)"
  
else
  # Synthea federated results
  echo "  Network-Level Results:"
  echo ""
  
  fed_lower=$(jq -r '.lower' "$OUTPUT_DIR/federated-bounds.json")
  fed_upper=$(jq -r '.upper' "$OUTPUT_DIR/federated-bounds.json")
  fed_width=$(jq -r '.width' "$OUTPUT_DIR/federated-bounds.json")
  
  echo "    Federated Bounds: [$(printf '%.4f' $fed_lower), $(printf '%.4f' $fed_upper)]"
  echo "    Width: $(printf '%.4f' $fed_width)"
  echo ""
  
  if [ -f "$OUTPUT_DIR/fri-results.json" ]; then
    min_evalue=$(jq -r '.fri.min_evalue' "$OUTPUT_DIR/fri-results.json")
    avg_evalue=$(jq -r '.fri.weighted_avg_evalue' "$OUTPUT_DIR/fri-results.json")
    interpretation=$(jq -r '.interpretation' "$OUTPUT_DIR/fri-results.json")
    
    echo "    FRI (minimum): $(printf '%.2f' $min_evalue)"
    echo "    FRI (weighted avg): $(printf '%.2f' $avg_evalue)"
    echo "    Robustness Level: $interpretation"
  fi
  
  echo ""
  echo "  Site-Level Summary:"
  echo ""
  printf "    %-8s %-20s %-25s %-12s\n" "Site" "Mode" "Bounds" "E-value"
  echo "    ────────────────────────────────────────────────────────────────────"
  
  for i in {1..3}; do
    mode=$(jq -r '.mode' "$DATA_DIR/site-${i}-mode.json")
    lower=$(jq -r '.lower' "$DATA_DIR/site-${i}-bounds.json")
    upper=$(jq -r '.upper' "$DATA_DIR/site-${i}-bounds.json")
    evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/site-${i}-evalue.json")
    
    printf "    Site %-3d %-20s [%.4f, %.4f]  %.2f\n" \
      "$i" "$mode" "$lower" "$upper" "$evalue"
  done
fi

echo ""
echo ""

##############################################################################
# Final Summary
##############################################################################
print_section_header "Pipeline Summary"

echo "  Complete hierarchical pipeline executed:"
echo ""
echo "    1. ✓ Assumption diagnostics (Module 3)"
echo "    2. ✓ Automatic mode selection (Module 3)"
echo "    3. ✓ Partial identification (Module 1)"
echo "    4. ✓ Sensitivity analysis (Module 2)"
echo ""

if [ "$IS_FEDERATED" = true ]; then
  echo "  Dataset: Synthea $DATASET (3 federated sites)"
  echo "  Aggregation: inverse-width (optimal)"
  echo ""
  echo "  Key findings:"
  echo "    • All sites diagnostics completed"
  echo "    • Federated bounds computed with optimal weighting"
  echo "    • Network robustness assessed via FRI"
else
  echo "  Dataset: MIMIC test (single site)"
  echo "  External validation results"
fi

echo ""
echo "  Results saved to: $OUTPUT_DIR"
echo ""

print_success "Hierarchical Pipeline Complete"
echo ""
