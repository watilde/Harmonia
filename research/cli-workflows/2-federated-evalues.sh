#!/bin/bash
##############################################################################
# Federated E-values Workflow
# 
# Demonstrates Federated Robustness Index (FRI) for multi-site sensitivity
# analysis. Based on research paper: "Federated E-values and Robustness Index
# for Multi-Site Causal Inference"
#
# Uses real OMOP data (Synthea 1k by default)
#
# Usage:
#   ./2-federated-evalues.sh [dataset]
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
OUTPUT_DIR="$SCRIPT_DIR/output/federated-evalues-$DATASET"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  🛡️  Federated E-values & Robustness Index - $DATASET Dataset"
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
# Compute Bounds and E-values
##############################################################################
print_section_header "Computing Bounds and E-values"

if [ "$IS_FEDERATED" = false ]; then
  # MIMIC: single test site
  echo "  Computing bounds for MIMIC test data..."
  compute_site_bounds \
    "$DATA_DIR/mimic-test-data.json" \
    "$DATA_DIR/mimic-bounds.json" \
    "mtr"
  
  echo "  Computing E-value..."
  compute_evalue_from_bounds \
    "$DATA_DIR/mimic-bounds.json" \
    "$DATA_DIR/mimic-evalue.json"
  
  cp "$DATA_DIR/mimic-evalue.json" "$OUTPUT_DIR/mimic-demo_evalues.json"
  
  print_success "E-value computed"
  echo ""
  
  print_section_header "MIMIC Test Results"
  echo "  Single site E-value analysis:"
  echo ""
  
  evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/mimic-evalue.json")
  interpretation=$(jq -r '.interpretation' "$DATA_DIR/mimic-evalue.json")
  
  echo "    E-value: $evalue"
  echo "    Interpretation: $interpretation"
  echo ""
  
  print_success "Workflow Complete"
  exit 0
fi

# Synthea: compute bounds and E-values at each site
echo "  Computing MTR bounds at each site..."
for i in {1..3}; do
  compute_site_bounds \
    "$DATA_DIR/site-${i}-data.json" \
    "$DATA_DIR/site-${i}-bounds.json" \
    "mtr"
done

echo ""
echo "  Computing E-values at each site..."
for i in {1..3}; do
  compute_evalue_from_bounds \
    "$DATA_DIR/site-${i}-bounds.json" \
    "$DATA_DIR/site-${i}-evalue.json"
done

print_success "Bounds and E-values computed"
echo ""

##############################################################################
# Compute Federated Robustness Index (FRI)
##############################################################################
print_section_header "Computing Federated Robustness Index (FRI)"

echo "  Aggregating E-values across sites..."
compute_fri \
  "$DATA_DIR" \
  "$OUTPUT_DIR/fri-results.json" \
  "site" \
  3

print_success "FRI computed"
echo ""

##############################################################################
# Display Site-Level E-values
##############################################################################
print_section_header "Site-Level E-values"

echo "  Individual site robustness:"
echo ""

for i in {1..3}; do
  evalue=$(jq -r '.conservative.evalue' "$DATA_DIR/site-${i}-evalue.json")
  lower=$(jq -r '.bounds.lower' "$DATA_DIR/site-${i}-evalue.json")
  upper=$(jq -r '.bounds.upper' "$DATA_DIR/site-${i}-evalue.json")
  sample_size=$(jq -r '.sampleSize' "$DATA_DIR/site-${i}-bounds.json")
  
  printf "    Site %d (n=%s): E-value=%.2f, Bounds=[%.4f, %.4f]\n" \
    "$i" "$sample_size" "$evalue" "$lower" "$upper"
done

echo ""
echo ""

##############################################################################
# Display FRI Results
##############################################################################
print_section_header "Federated Robustness Index Results"

if [ -f "$OUTPUT_DIR/fri-results.json" ]; then
  echo "  Network-wide robustness assessment:"
  echo ""
  
  min_evalue=$(jq -r '.fri.min_evalue' "$OUTPUT_DIR/fri-results.json")
  weighted_avg=$(jq -r '.fri.weighted_avg_evalue' "$OUTPUT_DIR/fri-results.json")
  interpretation=$(jq -r '.interpretation' "$OUTPUT_DIR/fri-results.json")
  
  echo "    Minimum E-value (conservative):  $min_evalue"
  echo "    Weighted Average E-value:         $weighted_avg"
  echo "    Network Robustness Level:         $interpretation"
  echo ""
  
  # Show contributing sites
  echo "  Site contributions:"
  echo ""
  for i in {1..3}; do
    site_evalue=$(jq -r ".siteEvalues[$((i-1))].evalue" "$OUTPUT_DIR/fri-results.json")
    sample_size=$(jq -r ".siteEvalues[$((i-1))].sample_size" "$OUTPUT_DIR/fri-results.json")
    robustness=$(jq -r ".siteEvalues[$((i-1))].robustness_level" "$OUTPUT_DIR/fri-results.json")
    
    printf "    Site %d: E-value=%s, n=%s, Level=%s\n" \
      "$i" "$site_evalue" "$sample_size" "$robustness"
  done
fi

echo ""
echo ""

##############################################################################
# Robustness Interpretation
##############################################################################
print_section_header "Robustness Interpretation"

echo "  E-value interpretation guide:"
echo ""
echo "    E-value ≥ 2.0:  Strong robustness (minimal confounding concern)"
echo "    1.5 ≤ E < 2.0:  Moderate robustness (some confounding possible)"
echo "    1.25 ≤ E < 1.5: Weak robustness (substantial confounding risk)"
echo "    E-value < 1.25: Very weak (high sensitivity to confounding)"
echo ""
echo "  Network assessment: $interpretation"
echo ""
echo "  Recommendation:"

if (( $(echo "$min_evalue >= 2.0" | bc -l) )); then
  echo "    ✓ Network shows strong robustness across all sites"
  echo "    ✓ Findings likely to hold under moderate unmeasured confounding"
elif (( $(echo "$min_evalue >= 1.5" | bc -l) )); then
  echo "    ⚠ Network shows moderate robustness"
  echo "    • Consider additional sensitivity analyses"
  echo "    • Collect more data on potential confounders"
else
  echo "    ⚠ Network shows weak robustness"
  echo "    • High risk of unmeasured confounding"
  echo "    • Additional validation strongly recommended"
  echo "    • Consider instrumental variable or other robust methods"
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
echo "  Key findings:"
echo "    • FRI aggregates robustness evidence across sites"
echo "    • Minimum E-value provides conservative network assessment"
echo "    • Weighted average E-value balances site contributions"
echo ""
print_success "Federated E-values Workflow Complete"
echo ""
