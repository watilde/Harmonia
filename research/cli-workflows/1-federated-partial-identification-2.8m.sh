#!/bin/bash
##############################################################################
# Federated Partial Identification Workflow - 2.8M Synthea Data
# 
# Uses real 2.8M Synthea OMOP data split into 3 sites
# Tests aggregation strategies on large-scale real-world data
##############################################################################

set -e  # Exit on error

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Import shared functions
source "$SCRIPT_DIR/utils/shared-functions.sh"

# Create output directory
OUTPUT_DIR="$SCRIPT_DIR/output/federated-partial-id-2.8m"
DATA_DIR="$OUTPUT_DIR/data"
mkdir -p "$OUTPUT_DIR" "$DATA_DIR"

# Path to 2.8m split data
SPLIT_DATA_DIR="$PROJECT_ROOT/research/data/raw/splits/2.8m"

echo "════════════════════════════════════════════════════════════════════"
echo "  📊 Federated Partial Identification - 2.8M Synthea Data"
echo "════════════════════════════════════════════════════════════════════"
echo ""

##############################################################################
# Verify 2.8m data exists
##############################################################################
if [ ! -d "$SPLIT_DATA_DIR" ]; then
  echo -e "${RED}Error: 2.8m split data not found at $SPLIT_DATA_DIR${NC}"
  echo "Please run: npm run data:split:2.8m"
  exit 1
fi

if [ ! -f "$SPLIT_DATA_DIR/site1.json" ] || \
   [ ! -f "$SPLIT_DATA_DIR/site2.json" ] || \
   [ ! -f "$SPLIT_DATA_DIR/site3.json" ]; then
  echo -e "${RED}Error: site1.json, site2.json, or site3.json not found${NC}"
  exit 1
fi

print_success "2.8m split data found"
echo ""

##############################################################################
# Copy split data to working directory
##############################################################################
print_section_header "Preparing 2.8M Data"

echo "  Copying split data files..."
cp "$SPLIT_DATA_DIR/site1.json" "$DATA_DIR/site1-data.json"
cp "$SPLIT_DATA_DIR/site2.json" "$DATA_DIR/site2-data.json"
cp "$SPLIT_DATA_DIR/site3.json" "$DATA_DIR/site3-data.json"
cp "$SPLIT_DATA_DIR/metadata.json" "$DATA_DIR/metadata.json"

# Display sample sizes
echo ""
echo "  Site sample sizes:"
site1_size=$(jq -r 'length' "$DATA_DIR/site1-data.json")
site2_size=$(jq -r 'length' "$DATA_DIR/site2-data.json")
site3_size=$(jq -r 'length' "$DATA_DIR/site3-data.json")
total_size=$((site1_size + site2_size + site3_size))

echo "    Site 1: n=${site1_size}"
echo "    Site 2: n=${site2_size}"
echo "    Site 3: n=${site3_size}"
echo "    Total:  n=${total_size}"
echo ""

print_success "Data prepared"
echo ""

##############################################################################
# Compute MTR bounds at each site
##############################################################################
print_section_header "Computing MTR Bounds at Each Site"

echo "  Computing bounds for Site 1..."
compute_site_bounds \
  "$DATA_DIR/site1-data.json" \
  "$DATA_DIR/site1-bounds.json" \
  "mtr"

echo "  Computing bounds for Site 2..."
compute_site_bounds \
  "$DATA_DIR/site2-data.json" \
  "$DATA_DIR/site2-bounds.json" \
  "mtr"

echo "  Computing bounds for Site 3..."
compute_site_bounds \
  "$DATA_DIR/site3-data.json" \
  "$DATA_DIR/site3-bounds.json" \
  "mtr"

print_success "Bounds computed for all sites"
echo ""

# Display site bounds
echo "  Site bounds:"
for i in {1..3}; do
  lower=$(jq -r '.lower' "$DATA_DIR/site${i}-bounds.json")
  upper=$(jq -r '.upper' "$DATA_DIR/site${i}-bounds.json")
  width=$(jq -r '.width' "$DATA_DIR/site${i}-bounds.json")
  echo "    Site $i: [${lower}, ${upper}], width=${width}"
done
echo ""

##############################################################################
# Compare Aggregation Strategies
##############################################################################
print_section_header "Comparing Aggregation Strategies"

echo -e "${BLUE}Federating with different strategies:${NC}"
compare_aggregation_strategies "$OUTPUT_DIR" "2.8m" \
  "$DATA_DIR/site1-bounds.json" \
  "$DATA_DIR/site2-bounds.json" \
  "$DATA_DIR/site3-bounds.json"

print_success "Strategy comparison complete"
echo ""

##############################################################################
# Summary
##############################################################################
print_section_header "Summary - 2.8M Synthea Data Results"

echo "  Results saved to: $OUTPUT_DIR"
echo ""
echo "  Aggregation results:"

# Display all strategy results
for strategy in weighted-average inverse-width conservative uniform; do
  result_file="$OUTPUT_DIR/2.8m_${strategy}.json"
  if [ -f "$result_file" ]; then
    lower=$(jq -r '.lower' "$result_file")
    upper=$(jq -r '.upper' "$result_file")
    width=$(jq -r '.width' "$result_file")
    printf "    %-18s: [%.4f, %.4f], width=%.4f\n" "$strategy" "$lower" "$upper" "$width"
  fi
done

echo ""
echo "  Key observations:"
echo "    • Large-scale real-world data validation"
echo "    • Sample sizes: Site1=${site1_size}, Site2=${site2_size}, Site3=${site3_size}"
echo "    • Total patients: ${total_size}"
echo ""
echo -e "${GREEN}✓ 2.8M Synthea Data Workflow Complete${NC}"
echo ""
