#!/bin/bash
##############################################################################
# Federated Partial Identification Workflow
# 
# Demonstrates optimal weighting strategies for federated causal bounds
# Based on research paper: "Federated Partial Identification with 
# Optimal Weighting Strategies"
#
# Workflow:
# 1. Generate data for balanced and imbalanced sites
# 2. Compute MTR bounds at each site
# 3. Compare aggregation strategies (weighted-average, conservative, etc.)
# 4. Analyze bound width and precision trade-offs
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/output/federated-partial-id"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

echo "════════════════════════════════════════════════════════════════════"
echo "  📊 Federated Partial Identification Workflow"
echo "════════════════════════════════════════════════════════════════════"
echo ""

##############################################################################
# Experiment 1: Balanced Sites
##############################################################################
print_section_header "Experiment 1: Balanced Sites (n=334 each)"

echo "  Generating data for 3 balanced sites..."
generate_balanced_sites 334 "$DATA_DIR" "balanced" 3
print_success "Data generated"
echo ""

echo "  Computing MTR bounds at each site..."
compute_bounds_for_sites "$DATA_DIR" "balanced" 3 "mtr"
print_success "Bounds computed"
echo ""

echo -e "${BLUE}Federating with different strategies:${NC}"
compare_aggregation_strategies "$OUTPUT_DIR" "balanced" \
  "$DATA_DIR/balanced-1-bounds.json" \
  "$DATA_DIR/balanced-2-bounds.json" \
  "$DATA_DIR/balanced-3-bounds.json"

print_success "Experiment 1 complete"
echo ""

##############################################################################
# Experiment 2: Imbalanced Sites
##############################################################################
print_section_header "Experiment 2: Imbalanced Sites (100, 334, 1000)"

echo "  Generating imbalanced data..."
sizes=(100 334 1000)
generate_imbalanced_sites sizes "$DATA_DIR" "imbalanced"

# Compute bounds for imbalanced sites
for i in {1..3}; do
  compute_site_bounds \
    "$DATA_DIR/imbalanced-${i}-data.json" \
    "$DATA_DIR/imbalanced-${i}-bounds.json" \
    "mtr"
done

print_success "Data generated and bounds computed"
echo ""

echo -e "${BLUE}Comparing strategies with imbalanced data:${NC}"
compare_aggregation_strategies "$OUTPUT_DIR" "imbalanced" \
  "$DATA_DIR/imbalanced-1-bounds.json" \
  "$DATA_DIR/imbalanced-2-bounds.json" \
  "$DATA_DIR/imbalanced-3-bounds.json"

print_success "Experiment 2 complete"
echo ""

##############################################################################
# Experiment 3: Worst-case vs MTR Bounds
##############################################################################
print_section_header "Experiment 3: Worst-case vs MTR Comparison"

echo "  Computing worst-case bounds..."
for i in {1..3}; do
  compute_site_bounds \
    "$DATA_DIR/balanced-${i}-data.json" \
    "$DATA_DIR/balanced-${i}-worst-case.json" \
    "worst-case"
done
print_success "Worst-case bounds computed"
echo ""

echo -e "${BLUE}Width comparison:${NC}"
for i in {1..3}; do
  mtr_width=$(jq -r '.width' "$DATA_DIR/balanced-${i}-bounds.json")
  wc_width=$(jq -r '.width' "$DATA_DIR/balanced-${i}-worst-case.json")
  echo "    Site $i: MTR=${mtr_width}, Worst-case=${wc_width}"
done

echo ""
print_success "Experiment 3 complete"
echo ""

##############################################################################
# Summary
##############################################################################
print_section_header "Summary"

echo "  Results saved to: $OUTPUT_DIR"
echo ""
echo "  Key findings:"
echo "    • Inverse-width weighting minimizes bound width"
echo "    • Performance advantage increases with site imbalance"
echo "    • MTR bounds are tighter than worst-case bounds"
echo ""
echo -e "${GREEN}✓ Federated Partial Identification Workflow Complete${NC}"
echo ""
